use std::{
    env,
    path::{Path, PathBuf},
    sync::OnceLock,
};

use tauri::Manager;

const TEAMCODE_WORKSPACE_RELATIVE_ROOT: &str = "workspace/TeamCode";
const TEAMCODE_SOURCE_RELATIVE_ROOT: &str = "src/main/java/org/firstinspires/ftc/teamcode";

static APP_DATA_ROOT: OnceLock<PathBuf> = OnceLock::new();
static RESOURCE_ROOT: OnceLock<PathBuf> = OnceLock::new();

pub(crate) fn init_app_paths(app: &tauri::App) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to find app data directory: {error}"))?;
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Failed to find resource directory: {error}"))?;

    let _ = APP_DATA_ROOT.set(app_data_dir);
    let _ = RESOURCE_ROOT.set(resource_dir.join("resources"));

    Ok(())
}

pub(crate) fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("Failed to find repo root")
}

pub(crate) fn writable_root() -> PathBuf {
    if let Some(root) = env::var_os("FTC_SIM_DATA_DIR") {
        return PathBuf::from(root);
    }

    if cfg!(debug_assertions) {
        return repo_root();
    }

    APP_DATA_ROOT
        .get()
        .cloned()
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

pub(crate) fn resource_root() -> PathBuf {
    if let Some(root) = env::var_os("FTC_SIM_RESOURCE_DIR") {
        return PathBuf::from(root);
    }

    if cfg!(debug_assertions) {
        return repo_root();
    }

    RESOURCE_ROOT.get().cloned().unwrap_or_else(|| {
        env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(Path::to_path_buf))
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    })
}

pub(crate) fn java_executable() -> PathBuf {
    for java_home in java_home_candidates(&resource_root()) {
        if is_usable_java_home(&java_home) {
            return java_home.join("bin").join(java_binary_name());
        }
    }

    PathBuf::from(java_binary_name())
}

pub(crate) fn sim_runner_jar_path() -> PathBuf {
    if cfg!(debug_assertions) {
        return repo_root()
            .join("apps")
            .join("runner")
            .join("build")
            .join("libs")
            .join("runner-1.0.0.jar");
    }

    resource_root()
        .join("java")
        .join("runner")
        .join("runner-1.0.0.jar")
}

pub(crate) fn cad_backend_jar_path() -> PathBuf {
    if cfg!(debug_assertions) {
        return repo_root()
            .join("apps")
            .join("cad-backend")
            .join("build")
            .join("libs")
            .join("cad-motion-backend-0.1.0.jar");
    }

    resource_root()
        .join("java")
        .join("cad-backend")
        .join("cad-motion-backend-0.1.0.jar")
}

pub(crate) fn cad_converter_path() -> PathBuf {
    let executable = if cfg!(target_os = "windows") {
        "cad-step-to-glb.exe"
    } else {
        "cad-step-to-glb"
    };

    if cfg!(debug_assertions) {
        let build_dir = repo_root()
            .join("native")
            .join("cad-step-to-glb")
            .join("build");
        return if cfg!(target_os = "windows") {
            build_dir.join("windows").join("Release").join(executable)
        } else {
            build_dir.join(executable)
        };
    }

    resource_root()
        .join("native")
        .join(if cfg!(target_os = "windows") {
            "windows"
        } else {
            "macos"
        })
        .join("bin")
        .join(executable)
}

pub(crate) fn cad_data_root() -> PathBuf {
    if cfg!(debug_assertions) {
        return repo_root().join("apps").join("cad-backend").join("work");
    }

    writable_root().join("cad-backend").join("work")
}

pub(crate) fn teamcode_workspace_root() -> PathBuf {
    writable_root().join(TEAMCODE_WORKSPACE_RELATIVE_ROOT)
}

pub(crate) fn teamcode_root() -> PathBuf {
    teamcode_workspace_root().join(TEAMCODE_SOURCE_RELATIVE_ROOT)
}

pub(crate) fn runner_log_path() -> PathBuf {
    writable_root().join("workspace").join("runner.log")
}

pub(crate) fn cad_backend_log_path() -> PathBuf {
    writable_root().join("workspace").join("cad-backend.log")
}

fn java_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    }
}

fn is_usable_java_home(java_home: &Path) -> bool {
    let java = java_home.join("bin").join(java_binary_name());
    if !java.exists() {
        return false;
    }

    if cfg!(target_os = "macos") {
        return java_home.join("lib").join("libjli.dylib").exists();
    }

    true
}

fn java_home_candidates(root: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    candidates.push(root.join("runtime"));
    candidates.push(root.join("runtime").join("Contents").join("Home"));

    if let Ok(entries) = std::fs::read_dir(root.join("runtime")) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|extension| extension == "jdk") {
                candidates.push(path.join("Contents").join("Home"));
            }
        }
    }

    if let Some(java_home) = env::var_os("JAVA_HOME") {
        candidates.push(PathBuf::from(java_home));
    }

    candidates
}
