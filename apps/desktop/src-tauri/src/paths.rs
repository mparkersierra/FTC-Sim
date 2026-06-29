use std::{
    env,
    path::{Path, PathBuf},
};

const TEAMCODE_WORKSPACE_RELATIVE_ROOT: &str = "workspace/TeamCode";
const TEAMCODE_SOURCE_RELATIVE_ROOT: &str = "src/main/java/org/firstinspires/ftc/teamcode";

pub(crate) fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("Failed to find repo root")
}

pub(crate) fn app_root() -> PathBuf {
    if cfg!(debug_assertions) {
        return repo_root();
    }

    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

pub(crate) fn teamcode_workspace_root() -> PathBuf {
    app_root().join(TEAMCODE_WORKSPACE_RELATIVE_ROOT)
}

pub(crate) fn teamcode_root() -> PathBuf {
    teamcode_workspace_root().join(TEAMCODE_SOURCE_RELATIVE_ROOT)
}

pub(crate) fn runner_log_path() -> PathBuf {
    app_root().join("workspace").join("runner.log")
}

pub(crate) fn cad_backend_log_path() -> PathBuf {
    app_root().join("workspace").join("cad-backend.log")
}
