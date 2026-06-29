use std::{
    env, fs,
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

use crate::paths::{cad_backend_log_path, repo_root};

static CAD_BACKEND: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static CAD_BACKEND_WORKER: OnceLock<Mutex<()>> = OnceLock::new();
static CAD_BACKEND_PORT: OnceLock<Mutex<Option<u16>>> = OnceLock::new();

const PORT_RELEASE_TIMEOUT: Duration = Duration::from_secs(10);
const PORT_RELEASE_POLL_INTERVAL: Duration = Duration::from_millis(100);
const BACKEND_START_TIMEOUT: Duration = Duration::from_secs(8);

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

    for parent in [root.join("runtime"), root.join("runtime").join("bin")] {
        let Ok(entries) = fs::read_dir(parent) else {
            continue;
        };

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

fn java_executable(root: &Path) -> PathBuf {
    for java_home in java_home_candidates(root) {
        if is_usable_java_home(&java_home) {
            return java_home.join("bin").join(java_binary_name());
        }
    }

    PathBuf::from(java_binary_name())
}

fn dynamic_backend_port() -> Result<u16, String> {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|e| e.to_string())
}

fn backend_port(force_new: bool) -> Result<u16, String> {
    let port = CAD_BACKEND_PORT.get_or_init(|| Mutex::new(None));
    let mut port = port.lock().map_err(|e| e.to_string())?;

    if force_new || port.is_none() {
        *port = Some(dynamic_backend_port()?);
    }

    port.ok_or_else(|| "CAD backend port has not been assigned".into())
}

fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("0.0.0.0", port)).is_ok()
}

fn wait_for_port_release(port: u16) -> Result<(), String> {
    let deadline = Instant::now() + PORT_RELEASE_TIMEOUT;

    while Instant::now() < deadline {
        if is_port_available(port) {
            return Ok(());
        }

        thread::sleep(PORT_RELEASE_POLL_INTERVAL);
    }

    Err(format!(
        "Timed out waiting for CAD backend port {port} to be released"
    ))
}

fn is_backend_accepting_connections(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn wait_for_backend_ready(child: &mut Child, port: u16) -> Result<(), String> {
    let deadline = Instant::now() + BACKEND_START_TIMEOUT;

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return Err(format!("CAD backend exited before opening port: {status}"));
        }

        if is_backend_accepting_connections(port) {
            return Ok(());
        }

        thread::sleep(PORT_RELEASE_POLL_INTERVAL);
    }

    Err(format!(
        "CAD backend did not accept connections on port {port} within {} seconds",
        BACKEND_START_TIMEOUT.as_secs()
    ))
}

fn kill_backend(child: &mut Child) -> Result<(), String> {
    match child.try_wait() {
        Ok(Some(_)) => Ok(()),
        Ok(None) => {
            child.kill().map_err(|e| e.to_string())?;
            child.wait().map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(error) => Err(error.to_string()),
    }
}

fn backend_log_stdio() -> Result<(Stdio, Stdio), String> {
    let log_path = cad_backend_log_path();
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let log_file = fs::File::create(log_path).map_err(|e| e.to_string())?;
    let err_file = log_file.try_clone().map_err(|e| e.to_string())?;

    Ok((Stdio::from(log_file), Stdio::from(err_file)))
}

fn spawn_cad_backend(root: &Path, port: u16) -> Result<Child, String> {
    let (stdout, stderr) = backend_log_stdio()?;
    let data_root = root.join("apps").join("cad-backend").join("work");
    let converter = root
        .join("native")
        .join("cad-step-to-glb")
        .join("build")
        .join(if cfg!(target_os = "windows") {
            "cad-step-to-glb.exe"
        } else {
            "cad-step-to-glb"
        });
    let backend_jar = root
        .join("apps")
        .join("cad-backend")
        .join("build")
        .join("libs")
        .join("cad-motion-backend-0.1.0.jar");

    if backend_jar.exists() {
        return Command::new(java_executable(root))
            .arg("-jar")
            .arg(backend_jar)
            .arg("--port")
            .arg(port.to_string())
            .arg("--data-root")
            .arg(data_root)
            .arg("--converter")
            .arg(converter)
            .stdin(Stdio::null())
            .stdout(stdout)
            .stderr(stderr)
            .spawn()
            .map_err(|e| e.to_string());
    }

    Command::new("./gradlew")
        .arg(":apps:cad-backend:run")
        .arg(format!(
            "--args=--port {} --data-root \"{}\" --converter \"{}\"",
            port,
            data_root.to_string_lossy(),
            converter.to_string_lossy()
        ))
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| e.to_string())
}

pub(crate) fn start_cad_backend_background(force_restart: bool) {
    thread::spawn(move || {
        let worker = CAD_BACKEND_WORKER.get_or_init(|| Mutex::new(()));
        let Ok(_worker_guard) = worker.try_lock() else {
            return;
        };

        let Ok(port) = backend_port(force_restart) else {
            eprintln!("Failed to choose CAD backend port");
            return;
        };

        if !force_restart && is_backend_accepting_connections(port) {
            return;
        }

        let root = repo_root();
        let backend = CAD_BACKEND.get_or_init(|| Mutex::new(None));

        if let Ok(mut backend) = backend.lock() {
            if let Some(child) = backend.as_mut() {
                let _ = kill_backend(child);
            }
            *backend = None;
        }

        let mut attempt = 1;
        loop {
            if let Err(error) = wait_for_port_release(port) {
                eprintln!("CAD backend restart attempt {attempt} waiting for port failed: {error}");
                attempt += 1;
                thread::sleep(Duration::from_secs(1));
                continue;
            }

            let mut child = match spawn_cad_backend(&root, port) {
                Ok(child) => child,
                Err(error) => {
                    eprintln!("CAD backend restart attempt {attempt} failed to spawn: {error}");
                    attempt += 1;
                    thread::sleep(Duration::from_secs(1));
                    continue;
                }
            };

            match wait_for_backend_ready(&mut child, port) {
                Ok(()) => {
                    if let Ok(mut backend) = backend.lock() {
                        *backend = Some(child);
                    }
                    println!("CAD backend started on port {port} on attempt {attempt}");
                    return;
                }
                Err(error) => {
                    eprintln!(
                        "CAD backend restart attempt {attempt} did not become ready: {error}"
                    );
                    let _ = kill_backend(&mut child);
                    attempt += 1;
                    thread::sleep(Duration::from_millis(250));
                }
            }
        }
    });
}

#[tauri::command]
pub(crate) fn cad_backend_base_url() -> Result<String, String> {
    Ok(format!("http://127.0.0.1:{}", backend_port(false)?))
}

#[tauri::command]
pub(crate) fn restart_cad_backend() -> Result<String, String> {
    start_cad_backend_background(true);
    Ok("CAD backend restart started".into())
}

#[tauri::command]
pub(crate) fn read_cad_backend_log() -> Result<String, String> {
    let log_path = cad_backend_log_path();
    if !log_path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(log_path).map_err(|e| e.to_string())
}
