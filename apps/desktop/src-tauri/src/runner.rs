use std::{
    env, fs,
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

use crate::{
    paths::{repo_root, runner_log_path, teamcode_workspace_root},
    teamcode::ensure_teamcode_workspace,
};

static SIM_RUNNER: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static SIM_RUNNER_WORKER: OnceLock<Mutex<()>> = OnceLock::new();
const SIM_RUNNER_PORT: u16 = 8080;
const TEAMCODE_COMPILE_ERROR_PREFIX: &str = "TEAMCODE_COMPILE_ERROR: ";
const TEAMCODE_COMPILE_STATUS_PREFIX: &str = "TEAMCODE_COMPILE_STATUS: ";
const PORT_RELEASE_TIMEOUT: Duration = Duration::from_secs(10);
const PORT_RELEASE_POLL_INTERVAL: Duration = Duration::from_millis(100);
const RUNNER_START_TIMEOUT: Duration = Duration::from_secs(5);

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
        "Timed out waiting for sim runner port {} to be released",
        port
    ))
}

fn is_runner_accepting_connections(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn wait_for_runner_ready(child: &mut Child, port: u16) -> Result<(), String> {
    let deadline = Instant::now() + RUNNER_START_TIMEOUT;

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return Err(format!("Sim runner exited before opening port: {}", status));
        }

        if is_runner_accepting_connections(port) {
            return Ok(());
        }

        thread::sleep(PORT_RELEASE_POLL_INTERVAL);
    }

    Err(format!(
        "Sim runner did not accept connections on port {} within {} seconds",
        port,
        RUNNER_START_TIMEOUT.as_secs()
    ))
}

fn kill_runner(child: &mut Child) -> Result<(), String> {
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

fn runner_log_stdio() -> Result<(Stdio, Stdio), String> {
    let log_path = runner_log_path();
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let log_file = fs::File::create(log_path).map_err(|e| e.to_string())?;
    let err_file = log_file.try_clone().map_err(|e| e.to_string())?;

    Ok((Stdio::from(log_file), Stdio::from(err_file)))
}

fn spawn_sim_runner(root: &Path) -> Result<Child, String> {
    ensure_teamcode_workspace()?;

    let teamcode_root = teamcode_workspace_root();
    let (stdout, stderr) = runner_log_stdio()?;
    let runner_jar = root
        .join("apps")
        .join("runner")
        .join("build")
        .join("libs")
        .join("runner-1.0.0.jar");

    if runner_jar.exists() {
        return Command::new(java_executable(root))
            .arg("-jar")
            .arg(runner_jar)
            .arg("--teamcode-root")
            .arg(teamcode_root)
            .stdin(Stdio::null())
            .stdout(stdout)
            .stderr(stderr)
            .spawn()
            .map_err(|e| e.to_string());
    }

    Command::new("./gradlew")
        .arg(":apps:runner:run")
        .arg(format!(
            "--args=--teamcode-root {}",
            teamcode_root.to_string_lossy()
        ))
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| e.to_string())
}

pub(crate) fn start_sim_runner_background(force_restart: bool) {
    thread::spawn(move || {
        let worker = SIM_RUNNER_WORKER.get_or_init(|| Mutex::new(()));
        let Ok(_worker_guard) = worker.try_lock() else {
            return;
        };

        if !force_restart && is_runner_accepting_connections(SIM_RUNNER_PORT) {
            return;
        }

        let root = repo_root();
        let runner = SIM_RUNNER.get_or_init(|| Mutex::new(None));

        if let Ok(mut runner) = runner.lock() {
            if let Some(child) = runner.as_mut() {
                let _ = kill_runner(child);
            }
            *runner = None;
        }

        let mut attempt = 1;
        loop {
            if let Err(error) = wait_for_port_release(SIM_RUNNER_PORT) {
                eprintln!("Sim runner restart attempt {attempt} waiting for port failed: {error}");
                attempt += 1;
                thread::sleep(Duration::from_secs(1));
                continue;
            }

            let mut child = match spawn_sim_runner(&root) {
                Ok(child) => child,
                Err(error) => {
                    eprintln!("Sim runner restart attempt {attempt} failed to spawn: {error}");
                    attempt += 1;
                    thread::sleep(Duration::from_secs(1));
                    continue;
                }
            };

            match wait_for_runner_ready(&mut child, SIM_RUNNER_PORT) {
                Ok(()) => {
                    if let Ok(mut runner) = runner.lock() {
                        *runner = Some(child);
                    }
                    println!("Sim runner started on attempt {attempt}");
                    return;
                }
                Err(error) => {
                    eprintln!("Sim runner restart attempt {attempt} did not become ready: {error}");
                    let _ = kill_runner(&mut child);
                    attempt += 1;
                    thread::sleep(Duration::from_millis(250));
                }
            }
        }
    });
}

#[tauri::command]
pub(crate) fn read_runner_log() -> Result<String, String> {
    let log_path = runner_log_path();
    if !log_path.exists() {
        return Ok(String::new());
    }

    let contents = fs::read_to_string(log_path).map_err(|e| e.to_string())?;
    let lines: Vec<String> = contents
        .lines()
        .filter_map(|line| {
            line.strip_prefix(TEAMCODE_COMPILE_ERROR_PREFIX)
                .or_else(|| line.strip_prefix(TEAMCODE_COMPILE_STATUS_PREFIX))
                .map(str::to_string)
        })
        .rev()
        .take(200)
        .collect();
    Ok(lines.into_iter().rev().collect::<Vec<_>>().join("\n"))
}

#[tauri::command]
pub(crate) fn restart_sim_runner() -> Result<String, String> {
    start_sim_runner_background(true);
    Ok("Sim runner restart started".into())
}
