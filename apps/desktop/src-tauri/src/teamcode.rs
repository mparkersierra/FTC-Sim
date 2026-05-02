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
const TEAMCODE_BASE_PACKAGE: &str = "org.firstinspires.ftc.teamcode";
const TEAMCODE_OPMODE_BASE_ITERATIVE: &str = "iterative";
const TEAMCODE_OPMODE_BASE_LINEAR: &str = "linear";

pub(crate) fn ensure_teamcode_workspace() -> Result<(), String> {
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

    validate_java_identifier(stem, "Java file name")?;
    Ok(stem.to_string())
}

fn java_package_name_from_path(relative_path: &Path) -> Result<String, String> {
    let mut package_parts = vec![TEAMCODE_BASE_PACKAGE.to_string()];

    let Some(parent) = relative_path.parent() else {
        return Ok(TEAMCODE_BASE_PACKAGE.to_string());
    };

    for component in parent.components() {
        let Component::Normal(component) = component else {
            return Err("Invalid folder path".into());
        };

        let Some(package_part) = component.to_str() else {
            return Err("Invalid package folder name".into());
        };

        validate_java_identifier(package_part, "Java package folder name")?;
        package_parts.push(package_part.to_string());
    }

    Ok(package_parts.join("."))
}

fn validate_java_identifier(value: &str, label: &str) -> Result<(), String> {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return Err(format!("Invalid {label}"));
    };

    if !(first == '_' || first == '$' || first.is_ascii_alphabetic())
        || !chars.all(|ch| ch == '_' || ch == '$' || ch.is_ascii_alphanumeric())
    {
        return Err(format!("{label} must be a valid Java identifier"));
    }

    Ok(())
}

fn with_teamcode_package_declaration(contents: &str, package_name: &str) -> String {
    let next_package_line = format!("package {package_name};");
    let mut replaced_package = false;
    let mut next_contents = Vec::new();

    for line in contents.lines() {
        if !replaced_package && line.trim_start().starts_with("package ") {
            next_contents.push(next_package_line.clone());
            replaced_package = true;
        } else {
            next_contents.push(line.to_string());
        }
    }

    if replaced_package {
        return format!("{}\n", next_contents.join("\n"));
    }

    format!("{next_package_line}\n\n{contents}")
}

fn update_java_file_package(file_path: &Path, relative_path: &Path) -> Result<(), String> {
    let package_name = java_package_name_from_path(relative_path)?;
    let contents = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    fs::write(
        file_path,
        with_teamcode_package_declaration(&contents, &package_name),
    )
    .map_err(|e| e.to_string())
}

fn update_java_packages_in_folder(base_dir: &Path, current_dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            update_java_packages_in_folder(base_dir, &path)?;
        } else if path
            .extension()
            .is_some_and(|extension| extension == "java")
        {
            let relative_path = path.strip_prefix(base_dir).map_err(|e| e.to_string())?;
            update_java_file_package(&path, relative_path)?;
        }
    }

    Ok(())
}

fn new_teamcode_java_source(
    class_name: &str,
    package_name: &str,
    op_mode_base: &str,
    template: &str,
) -> Result<String, String> {
    match template {
        TEAMCODE_FILE_TEMPLATE_JAVA_CLASS => Ok(format!(
            r#"package {package_name};

public class {class_name} {{
}}
"#
        )),
        TEAMCODE_FILE_TEMPLATE_AUTONOMOUS => {
            new_teamcode_opmode_source(class_name, package_name, op_mode_base, "Autonomous")
        }
        TEAMCODE_FILE_TEMPLATE_TELEOP => {
            new_teamcode_opmode_source(class_name, package_name, op_mode_base, "TeleOp")
        }
        _ => Err("Invalid file template".into()),
    }
}

fn new_teamcode_opmode_source(
    class_name: &str,
    package_name: &str,
    op_mode_base: &str,
    annotation: &str,
) -> Result<String, String> {
    match op_mode_base {
        TEAMCODE_OPMODE_BASE_LINEAR => Ok(format!(
            r#"package {package_name};

import com.qualcomm.robotcore.eventloop.opmode.{annotation};
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

@{annotation}(name = "{class_name}")
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
        TEAMCODE_OPMODE_BASE_ITERATIVE => Ok(format!(
            r#"package {package_name};

import com.qualcomm.robotcore.eventloop.opmode.{annotation};
import com.qualcomm.robotcore.eventloop.opmode.OpMode;

@{annotation}(name = "{class_name}")
public class {class_name} extends OpMode {{
    @Override
    public void init() {{
    }}

    @Override
    public void loop() {{
    }}
}}
"#
        )),
        _ => Err("Invalid OpMode base".into()),
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

#[tauri::command]
pub(crate) fn save_teamcode_file(
    relative_path: String,
    contents: String,
) -> Result<String, String> {
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
    op_mode_base: Option<String>,
    relative_path: String,
    template: Option<String>,
) -> Result<String, String> {
    let relative_path = validate_teamcode_java_path(&relative_path)?;
    let class_name = java_class_name_from_path(&relative_path)?;
    let package_name = java_package_name_from_path(&relative_path)?;
    ensure_teamcode_workspace()?;

    let file_path = teamcode_root().join(&relative_path);
    if file_path.exists() {
        return Err("File already exists".into());
    }

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let template = template.unwrap_or_else(|| TEAMCODE_FILE_TEMPLATE_AUTONOMOUS.to_string());
    let op_mode_base = op_mode_base.unwrap_or_else(|| TEAMCODE_OPMODE_BASE_LINEAR.to_string());
    let contents = new_teamcode_java_source(&class_name, &package_name, &op_mode_base, &template)?;
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
    let package_name = java_package_name_from_path(&to_path)?;
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
    let contents = contents.replace(&old_class_name, &class_name);
    fs::write(
        &from_path,
        with_teamcode_package_declaration(&contents, &package_name),
    )
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

    fs::rename(&from_path, &to_path).map_err(|e| e.to_string())?;
    update_java_packages_in_folder(&teamcode_root(), &to_path)?;
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
