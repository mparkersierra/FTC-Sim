use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use crate::paths::teamcode_root;

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

pub(crate) fn ensure_teamcode_workspace() -> Result<(), String> {
    let root = teamcode_root();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    if !has_teamcode_java_files(&root)? {
        fs::write(root.join(EXAMPLE_AUTONOMOUS_FILE), EXAMPLE_AUTONOMOUS_SOURCE)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
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

        if path.extension().is_some_and(|extension| extension == "java") {
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
        } else if path.extension().is_some_and(|extension| extension == "java") {
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

#[tauri::command]
pub(crate) fn save_teamcode_file(relative_path: String, contents: String) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    let file_path = teamcode_root().join(&relative_path);

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&file_path, contents).map_err(|e| e.to_string())?;

    Ok("Saved successfully".into())
}

#[tauri::command]
pub(crate) fn create_teamcode_file(
    relative_path: String,
    template: Option<String>,
) -> Result<String, String> {
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
pub(crate) fn create_teamcode_folder(relative_path: String) -> Result<String, String> {
    let relative_path = validate_teamcode_directory_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    fs::create_dir_all(teamcode_root().join(relative_path)).map_err(|e| e.to_string())?;
    Ok("Folder created".into())
}

#[tauri::command]
pub(crate) fn rename_teamcode_file(from_path: String, to_path: String) -> Result<String, String> {
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
pub(crate) fn rename_teamcode_folder(from_path: String, to_path: String) -> Result<String, String> {
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
pub(crate) fn delete_teamcode_file(relative_path: String) -> Result<String, String> {
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
pub(crate) fn delete_teamcode_folder(relative_path: String) -> Result<String, String> {
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
pub(crate) fn list_teamcode_files() -> Result<Vec<String>, String> {
    ensure_teamcode_workspace()?;
    let base_dir = teamcode_root();
    let mut files = Vec::new();

    collect_teamcode_files(&base_dir, &base_dir, &mut files)?;

    files.sort();
    Ok(files)
}

#[tauri::command]
pub(crate) fn list_teamcode_directories() -> Result<Vec<String>, String> {
    ensure_teamcode_workspace()?;
    let base_dir = teamcode_root();
    let mut directories = Vec::new();

    collect_teamcode_directories(&base_dir, &base_dir, &mut directories)?;

    directories.sort();
    Ok(directories)
}

#[tauri::command]
pub(crate) fn read_teamcode_file(relative_path: String) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    fs::read_to_string(teamcode_root().join(relative_path)).map_err(|e| e.to_string())
}
