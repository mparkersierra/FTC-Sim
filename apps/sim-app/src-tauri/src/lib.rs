#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env, fs,
    net::{TcpListener, TcpStream},
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

static SIM_RUNNER: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static SIM_RUNNER_WORKER: OnceLock<Mutex<()>> = OnceLock::new();
const SIM_RUNNER_PORT: u16 = 8080;
const PORT_RELEASE_TIMEOUT: Duration = Duration::from_secs(10);
const PORT_RELEASE_POLL_INTERVAL: Duration = Duration::from_millis(100);
const RUNNER_START_TIMEOUT: Duration = Duration::from_secs(5);
const TEAMCODE_WORKSPACE_RELATIVE_ROOT: &str = "workspace/TeamCode";
const TEAMCODE_SOURCE_RELATIVE_ROOT: &str = "src/main/java/org/firstinspires/ftc/teamcode";
const EXAMPLE_AUTONOMOUS_FILE: &str = "ExampleAutonomous.java";
const EXAMPLE_AUTONOMOUS_SOURCE: &str = r#"package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@Autonomous(name = "Example Autonomous")
public class ExampleAutonomous extends LinearOpMode {
    /*
        * FTC Sim runs normal FTC-style Java OpModes from this TeamCode folder.
        * For now, the simulator can only drive DcMotor hardware. Configure motor
        * names in the Configuration tab, then use the same names with hardwareMap.
    */

    private DcMotor leftFront;
    private DcMotor rightFront;
    private DcMotor leftBack;
    private DcMotor rightBack;

    @Override
    public void runOpMode() {

        leftFront = hardwareMap.get(DcMotor.class, "leftFront");
        rightFront = hardwareMap.get(DcMotor.class, "rightFront");
        leftBack = hardwareMap.get(DcMotor.class, "leftBack");
        rightBack = hardwareMap.get(DcMotor.class, "rightBack");

        leftFront.setDirection(DcMotor.Direction.REVERSE);
        leftBack.setDirection(DcMotor.Direction.REVERSE);

        waitForStart();

        setDrivePower(1);
        sleep(100);
        setDrivePower(0.0);
    }

    private void setDrivePower(double power) {
        leftFront.setPower(power);
        rightFront.setPower(power);
        leftBack.setPower(power);
        rightBack.setPower(power);
    }
}
"#;
const TEAMCODE_FILE_TEMPLATE_JAVA_CLASS: &str = "java_class";
const TEAMCODE_FILE_TEMPLATE_AUTONOMOUS: &str = "autonomous";
const TEAMCODE_FILE_TEMPLATE_TELEOP: &str = "teleop";

/// Get repo root (go up from src-tauri)
fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .expect("Failed to find repo root")
}

fn teamcode_root() -> PathBuf {
    teamcode_workspace_root().join(TEAMCODE_SOURCE_RELATIVE_ROOT)
}

fn app_root() -> PathBuf {
    if cfg!(debug_assertions) {
        return repo_root();
    }

    env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn teamcode_workspace_root() -> PathBuf {
    app_root().join(TEAMCODE_WORKSPACE_RELATIVE_ROOT)
}

fn ensure_teamcode_workspace() -> Result<(), String> {
    let root = teamcode_root();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    if !has_teamcode_java_files(&root)? {
        fs::write(
            root.join(EXAMPLE_AUTONOMOUS_FILE),
            EXAMPLE_AUTONOMOUS_SOURCE,
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
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

fn validate_teamcode_java_path(relative_path: &str) -> Result<PathBuf, String> {
    if !relative_path.ends_with(".java") {
        return Err("Only .java files allowed".into());
    }

    let relative_path = PathBuf::from(relative_path);
    if relative_path.is_absolute()
        || relative_path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Invalid file path".into());
    }

    Ok(relative_path)
}

fn validate_teamcode_directory_path(relative_path: &str) -> Result<PathBuf, String> {
    let relative_path = PathBuf::from(relative_path);
    if relative_path.as_os_str().is_empty()
        || relative_path.is_absolute()
        || relative_path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Invalid folder path".into());
    }

    Ok(relative_path)
}

fn java_class_name_from_path(relative_path: &Path) -> Result<String, String> {
    let Some(stem) = relative_path.file_stem().and_then(|value| value.to_str()) else {
        return Err("Invalid Java file name".into());
    };

    let mut chars = stem.chars();
    let Some(first) = chars.next() else {
        return Err("Invalid Java file name".into());
    };

    if !(first == '_' || first == '$' || first.is_ascii_alphabetic())
        || !chars.all(|ch| ch == '_' || ch == '$' || ch.is_ascii_alphanumeric())
    {
        return Err("Java file name must be a valid Java class name".into());
    }

    Ok(stem.to_string())
}

fn new_teamcode_java_source(class_name: &str, template: &str) -> Result<String, String> {
    match template {
        TEAMCODE_FILE_TEMPLATE_JAVA_CLASS => Ok(format!(
            r#"package org.firstinspires.ftc.teamcode;

public class {class_name} {{
}}
"#
        )),
        TEAMCODE_FILE_TEMPLATE_AUTONOMOUS => Ok(format!(
            r#"package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

@Autonomous(name = "{class_name}")
public class {class_name} extends LinearOpMode {{
    @Override
    public void runOpMode() {{
        waitForStart();

        while (opModeIsActive()) {{
            sleep(20);
        }}
    }}
}}
"#
        )),
        TEAMCODE_FILE_TEMPLATE_TELEOP => Ok(format!(
            r#"package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name = "{class_name}")
public class {class_name} extends LinearOpMode {{
    @Override
    public void runOpMode() {{
        waitForStart();

        while (opModeIsActive()) {{
            sleep(20);
        }}
    }}
}}
"#
        )),
        _ => Err("Invalid file template".into()),
    }
}

fn has_teamcode_java_files(root: &Path) -> Result<bool, String> {
    if !root.exists() {
        return Ok(false);
    }

    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() && has_teamcode_java_files(&path)? {
            return Ok(true);
        }

        if path
            .extension()
            .is_some_and(|extension| extension == "java")
        {
            return Ok(true);
        }
    }

    Ok(false)
}

fn collect_teamcode_files(
    base_dir: &Path,
    current_dir: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    if !current_dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            collect_teamcode_files(base_dir, &path, files)?;
        } else if path
            .extension()
            .is_some_and(|extension| extension == "java")
        {
            let relative_path = path.strip_prefix(base_dir).map_err(|e| e.to_string())?;
            files.push(relative_path.to_string_lossy().replace('\\', "/"));
        }
    }

    Ok(())
}

fn collect_teamcode_directories(
    base_dir: &Path,
    current_dir: &Path,
    directories: &mut Vec<String>,
) -> Result<(), String> {
    if !current_dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let relative_path = path.strip_prefix(base_dir).map_err(|e| e.to_string())?;
            directories.push(relative_path.to_string_lossy().replace('\\', "/"));
            collect_teamcode_directories(base_dir, &path, directories)?;
        }
    }

    Ok(())
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

fn runner_log_path() -> PathBuf {
    app_root().join("workspace").join("runner.log")
}

fn spawn_sim_runner(root: &Path) -> Result<Child, String> {
    ensure_teamcode_workspace()?;

    let teamcode_root = teamcode_workspace_root();
    let (stdout, stderr) = runner_log_stdio()?;
    let runner_jar = root
        .join("apps")
        .join("sim-runner")
        .join("build")
        .join("libs")
        .join("sim-runner-1.0.0.jar");

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
        .arg(":apps:sim-runner:run")
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

fn start_sim_runner_background(force_restart: bool) {
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

/// Save Java file + compile TeamCode
#[tauri::command]
fn save_teamcode_file(relative_path: String, contents: String) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    let file_path = teamcode_root().join(&relative_path);

    // Ensure directories exist
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Write file
    fs::write(&file_path, contents).map_err(|e| e.to_string())?;

    Ok("Saved successfully".into())
}

#[tauri::command]
fn create_teamcode_file(relative_path: String, template: Option<String>) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    let class_name = java_class_name_from_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    let file_path = teamcode_root().join(&relative_path);
    if file_path.exists() {
        return Err("File already exists".into());
    }

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let template = template.unwrap_or_else(|| TEAMCODE_FILE_TEMPLATE_AUTONOMOUS.to_string());
    let contents = new_teamcode_java_source(&class_name, &template)?;
    fs::write(&file_path, &contents).map_err(|e| e.to_string())?;
    Ok(contents)
}

#[tauri::command]
fn create_teamcode_folder(relative_path: String) -> Result<String, String> {
    let relative_path = validate_teamcode_directory_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    fs::create_dir_all(teamcode_root().join(relative_path)).map_err(|e| e.to_string())?;
    Ok("Folder created".into())
}

#[tauri::command]
fn rename_teamcode_file(from_path: String, to_path: String) -> Result<String, String> {
    let from_path = validate_teamcode_java_path(&from_path)?;
    let old_class_name = java_class_name_from_path(&from_path)?;
    let to_path = validate_teamcode_java_path(&to_path)?;
    let class_name = java_class_name_from_path(&to_path)?;
    ensure_teamcode_workspace()?;

    let from_path = teamcode_root().join(from_path);
    let to_path = teamcode_root().join(to_path);

    if !from_path.is_file() {
        return Err("File does not exist".into());
    }

    if to_path.exists() {
        return Err("Destination already exists".into());
    }

    if let Some(parent) = to_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let contents = fs::read_to_string(&from_path).map_err(|e| e.to_string())?;
    fs::write(&from_path, contents.replace(&old_class_name, &class_name))
        .map_err(|e| e.to_string())?;
    fs::rename(from_path, to_path).map_err(|e| e.to_string())?;
    Ok(class_name)
}

#[tauri::command]
fn rename_teamcode_folder(from_path: String, to_path: String) -> Result<String, String> {
    let from_path = validate_teamcode_directory_path(&from_path)?;
    let to_path = validate_teamcode_directory_path(&to_path)?;
    ensure_teamcode_workspace()?;

    let from_path = teamcode_root().join(from_path);
    let to_path = teamcode_root().join(to_path);

    if !from_path.is_dir() {
        return Err("Folder does not exist".into());
    }

    if to_path.exists() {
        return Err("Destination already exists".into());
    }

    if let Some(parent) = to_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(from_path, to_path).map_err(|e| e.to_string())?;
    Ok("Folder renamed".into())
}

#[tauri::command]
fn delete_teamcode_file(relative_path: String) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    let file_path = teamcode_root().join(relative_path);
    if !file_path.is_file() {
        return Err("File does not exist".into());
    }

    fs::remove_file(file_path).map_err(|e| e.to_string())?;
    Ok("File deleted".into())
}

#[tauri::command]
fn delete_teamcode_folder(relative_path: String) -> Result<String, String> {
    let relative_path = validate_teamcode_directory_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    let folder_path = teamcode_root().join(relative_path);
    if !folder_path.is_dir() {
        return Err("Folder does not exist".into());
    }

    fs::remove_dir_all(folder_path).map_err(|e| e.to_string())?;
    Ok("Folder deleted".into())
}

#[tauri::command]
fn list_teamcode_files() -> Result<Vec<String>, String> {
    ensure_teamcode_workspace()?;
    let base_dir = teamcode_root();
    let mut files = Vec::new();

    collect_teamcode_files(&base_dir, &base_dir, &mut files)?;

    files.sort();
    Ok(files)
}

#[tauri::command]
fn list_teamcode_directories() -> Result<Vec<String>, String> {
    ensure_teamcode_workspace()?;
    let base_dir = teamcode_root();
    let mut directories = Vec::new();

    collect_teamcode_directories(&base_dir, &base_dir, &mut directories)?;

    directories.sort();
    Ok(directories)
}

#[tauri::command]
fn read_teamcode_file(relative_path: String) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    fs::read_to_string(teamcode_root().join(relative_path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_runner_log() -> Result<String, String> {
    let log_path = runner_log_path();
    if !log_path.exists() {
        return Ok(String::new());
    }

    let contents = fs::read_to_string(log_path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = contents.lines().rev().take(200).collect();
    Ok(lines.into_iter().rev().collect::<Vec<_>>().join("\n"))
}

/// Restart sim-runner after a successful TeamCode compile.
#[tauri::command]
fn restart_sim_runner() -> Result<String, String> {
    start_sim_runner_background(true);
    Ok("Sim runner restart started".into())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|_| {
            start_sim_runner_background(false);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_teamcode_file,
            create_teamcode_file,
            create_teamcode_folder,
            rename_teamcode_file,
            rename_teamcode_folder,
            delete_teamcode_file,
            delete_teamcode_folder,
            list_teamcode_files,
            list_teamcode_directories,
            read_teamcode_file,
            read_runner_log,
            restart_sim_runner
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
