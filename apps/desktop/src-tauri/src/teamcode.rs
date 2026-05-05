use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{Read, Seek, Write},
    path::{Component, Path, PathBuf},
};

use flate2::read::DeflateDecoder;
use serde::Deserialize;
use serde::Serialize;
use tauri::{AppHandle, Manager};

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
const TEAMCODE_EXPORT_ROOT: &str = "teamcode/";
const FTC_REPO_TEAMCODE_SOURCE_ROOT: &str =
    "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/";
const ZIP_LOCAL_FILE_HEADER_SIGNATURE: u32 = 0x0403_4b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE: u32 = 0x0201_4b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE: u32 = 0x0605_4b50;
const ZIP_METHOD_STORED: u16 = 0;
const ZIP_METHOD_DEFLATED: u16 = 8;
const GITHUB_HOST: &str = "github.com";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TeamCodeZipImportPreview {
    archive_kind: String,
    files: Vec<String>,
    conflicts: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TeamCodeZipImportDecision {
    action: String,
    rename_path: Option<String>,
}

struct ZipFileEntry {
    name: String,
    contents: Vec<u8>,
}

struct TeamCodeZipImportFile {
    relative_path: String,
    contents: Vec<u8>,
}

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

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffff;

    for byte in bytes {
        crc ^= u32::from(*byte);

        for _ in 0..8 {
            let mask = 0u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }

    !crc
}

fn write_u16<W: Write>(writer: &mut W, value: u16) -> Result<(), String> {
    writer
        .write_all(&value.to_le_bytes())
        .map_err(|e| e.to_string())
}

fn write_u32<W: Write>(writer: &mut W, value: u32) -> Result<(), String> {
    writer
        .write_all(&value.to_le_bytes())
        .map_err(|e| e.to_string())
}

struct ZipEntry {
    name: String,
    crc32: u32,
    size: u32,
    offset: u32,
    is_directory: bool,
}

fn write_zip_entry<W: Seek + Write>(
    writer: &mut W,
    name: String,
    contents: &[u8],
    is_directory: bool,
    entries: &mut Vec<ZipEntry>,
) -> Result<(), String> {
    let offset = writer.stream_position().map_err(|e| e.to_string())?;
    let name_bytes = name.as_bytes();
    let name_length =
        u16::try_from(name_bytes.len()).map_err(|_| "Zip entry path is too long".to_string())?;
    let size = u32::try_from(contents.len()).map_err(|_| "Zip entry is too large".to_string())?;
    let crc = if is_directory { 0 } else { crc32(contents) };

    write_u32(writer, 0x0403_4b50)?;
    write_u16(writer, 20)?;
    write_u16(writer, 0)?;
    write_u16(writer, 0)?;
    write_u16(writer, 0)?;
    write_u16(writer, 0)?;
    write_u32(writer, crc)?;
    write_u32(writer, size)?;
    write_u32(writer, size)?;
    write_u16(writer, name_length)?;
    write_u16(writer, 0)?;
    writer.write_all(name_bytes).map_err(|e| e.to_string())?;
    writer.write_all(contents).map_err(|e| e.to_string())?;

    entries.push(ZipEntry {
        name,
        crc32: crc,
        size,
        offset: u32::try_from(offset).map_err(|_| "Zip file is too large".to_string())?,
        is_directory,
    });

    Ok(())
}

fn add_teamcode_directory_to_zip<W: Seek + Write>(
    writer: &mut W,
    base_dir: &Path,
    current_dir: &Path,
    entries: &mut Vec<ZipEntry>,
) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let relative_path = path
            .strip_prefix(base_dir)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            write_zip_entry(
                writer,
                format!("{TEAMCODE_EXPORT_ROOT}{relative_path}/"),
                &[],
                true,
                entries,
            )?;
            add_teamcode_directory_to_zip(writer, base_dir, &path, entries)?;
        } else if path.is_file() {
            let contents = fs::read(&path).map_err(|e| e.to_string())?;
            write_zip_entry(
                writer,
                format!("{TEAMCODE_EXPORT_ROOT}{relative_path}"),
                &contents,
                false,
                entries,
            )?;
        }
    }

    Ok(())
}

fn finish_zip<W: Seek + Write>(writer: &mut W, entries: &[ZipEntry]) -> Result<(), String> {
    let central_directory_offset = writer.stream_position().map_err(|e| e.to_string())?;

    for entry in entries {
        let name_bytes = entry.name.as_bytes();
        let name_length = u16::try_from(name_bytes.len())
            .map_err(|_| "Zip entry path is too long".to_string())?;
        let external_attributes = if entry.is_directory { 0x10 } else { 0 };

        write_u32(writer, 0x0201_4b50)?;
        write_u16(writer, 20)?;
        write_u16(writer, 20)?;
        write_u16(writer, 0)?;
        write_u16(writer, 0)?;
        write_u16(writer, 0)?;
        write_u16(writer, 0)?;
        write_u32(writer, entry.crc32)?;
        write_u32(writer, entry.size)?;
        write_u32(writer, entry.size)?;
        write_u16(writer, name_length)?;
        write_u16(writer, 0)?;
        write_u16(writer, 0)?;
        write_u16(writer, 0)?;
        write_u16(writer, 0)?;
        write_u32(writer, external_attributes)?;
        write_u32(writer, entry.offset)?;
        writer.write_all(name_bytes).map_err(|e| e.to_string())?;
    }

    let central_directory_size = writer
        .stream_position()
        .map_err(|e| e.to_string())?
        .checked_sub(central_directory_offset)
        .ok_or_else(|| "Invalid zip central directory".to_string())?;
    let entry_count =
        u16::try_from(entries.len()).map_err(|_| "Too many files to export".to_string())?;

    write_u32(writer, 0x0605_4b50)?;
    write_u16(writer, 0)?;
    write_u16(writer, 0)?;
    write_u16(writer, entry_count)?;
    write_u16(writer, entry_count)?;
    write_u32(
        writer,
        u32::try_from(central_directory_size).map_err(|_| "Zip file is too large".to_string())?,
    )?;
    write_u32(
        writer,
        u32::try_from(central_directory_offset).map_err(|_| "Zip file is too large".to_string())?,
    )?;
    write_u16(writer, 0)
}

fn read_zip_u16(bytes: &[u8], offset: usize) -> Result<u16, String> {
    let end = offset
        .checked_add(2)
        .ok_or_else(|| "Invalid zip offset".to_string())?;
    let value = bytes
        .get(offset..end)
        .ok_or_else(|| "Invalid zip file".to_string())?;
    Ok(u16::from_le_bytes([value[0], value[1]]))
}

fn read_zip_u32(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| "Invalid zip offset".to_string())?;
    let value = bytes
        .get(offset..end)
        .ok_or_else(|| "Invalid zip file".to_string())?;
    Ok(u32::from_le_bytes([value[0], value[1], value[2], value[3]]))
}

fn find_zip_end_of_central_directory(bytes: &[u8]) -> Result<usize, String> {
    let minimum_size = 22;
    if bytes.len() < minimum_size {
        return Err("File is too small to be a zip archive".into());
    }

    let search_start = bytes.len().saturating_sub(65_557);
    for offset in (search_start..=bytes.len() - 4).rev() {
        if read_zip_u32(bytes, offset)? == ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE {
            return Ok(offset);
        }
    }

    Err("Invalid zip file".into())
}

fn read_zip_archive(bytes: &[u8]) -> Result<Vec<ZipFileEntry>, String> {
    let eocd_offset = find_zip_end_of_central_directory(bytes)?;
    let entry_count = usize::from(read_zip_u16(bytes, eocd_offset + 10)?);
    let central_directory_offset = usize::try_from(read_zip_u32(bytes, eocd_offset + 16)?)
        .map_err(|_| "Zip file is too large".to_string())?;
    let mut cursor = central_directory_offset;
    let mut entries = Vec::new();

    for _ in 0..entry_count {
        if read_zip_u32(bytes, cursor)? != ZIP_CENTRAL_DIRECTORY_SIGNATURE {
            return Err("Invalid zip central directory".into());
        }

        let flags = read_zip_u16(bytes, cursor + 8)?;
        let method = read_zip_u16(bytes, cursor + 10)?;
        let compressed_size = usize::try_from(read_zip_u32(bytes, cursor + 20)?)
            .map_err(|_| "Zip file is too large".to_string())?;
        let name_length = usize::from(read_zip_u16(bytes, cursor + 28)?);
        let extra_length = usize::from(read_zip_u16(bytes, cursor + 30)?);
        let comment_length = usize::from(read_zip_u16(bytes, cursor + 32)?);
        let local_header_offset = usize::try_from(read_zip_u32(bytes, cursor + 42)?)
            .map_err(|_| "Zip file is too large".to_string())?;
        let name_start = cursor + 46;
        let name_end = name_start
            .checked_add(name_length)
            .ok_or_else(|| "Invalid zip entry name".to_string())?;
        let name = String::from_utf8_lossy(
            bytes
                .get(name_start..name_end)
                .ok_or_else(|| "Invalid zip entry name".to_string())?,
        )
        .replace('\\', "/");

        cursor = name_end
            .checked_add(extra_length)
            .and_then(|offset| offset.checked_add(comment_length))
            .ok_or_else(|| "Invalid zip central directory".to_string())?;

        if name.ends_with('/') {
            continue;
        }

        if flags & 1 != 0 {
            return Err("Encrypted zip files are not supported".into());
        }

        if read_zip_u32(bytes, local_header_offset)? != ZIP_LOCAL_FILE_HEADER_SIGNATURE {
            return Err("Invalid zip local file header".into());
        }

        let local_name_length = usize::from(read_zip_u16(bytes, local_header_offset + 26)?);
        let local_extra_length = usize::from(read_zip_u16(bytes, local_header_offset + 28)?);
        let data_start = local_header_offset
            .checked_add(30)
            .and_then(|offset| offset.checked_add(local_name_length))
            .and_then(|offset| offset.checked_add(local_extra_length))
            .ok_or_else(|| "Invalid zip local file header".to_string())?;
        let data_end = data_start
            .checked_add(compressed_size)
            .ok_or_else(|| "Invalid zip file data".to_string())?;
        let compressed = bytes
            .get(data_start..data_end)
            .ok_or_else(|| "Invalid zip file data".to_string())?;

        let contents = match method {
            ZIP_METHOD_STORED => compressed.to_vec(),
            ZIP_METHOD_DEFLATED => {
                let mut decoder = DeflateDecoder::new(compressed);
                let mut contents = Vec::new();
                decoder
                    .read_to_end(&mut contents)
                    .map_err(|error| format!("Failed to decompress zip entry {name}: {error}"))?;
                contents
            }
            _ => return Err(format!("Unsupported zip compression method {method}")),
        };

        entries.push(ZipFileEntry { name, contents });
    }

    Ok(entries)
}

fn teamcode_import_relative_path(entry_name: &str, prefer_ftc_repo_root: bool) -> Option<String> {
    let entry_name = entry_name.trim_start_matches('/');

    if prefer_ftc_repo_root {
        if let Some(index) = entry_name.find(FTC_REPO_TEAMCODE_SOURCE_ROOT) {
            return Some(entry_name[index + FTC_REPO_TEAMCODE_SOURCE_ROOT.len()..].to_string());
        }
        return None;
    }

    let mut parts = entry_name.splitn(2, '/');
    let first = parts.next()?;
    if first.eq_ignore_ascii_case("teamcode") {
        return parts.next().map(ToString::to_string);
    }

    None
}

fn collect_teamcode_zip_import_files(
    archive_bytes: &[u8],
) -> Result<(String, Vec<TeamCodeZipImportFile>), String> {
    let zip_entries = read_zip_archive(archive_bytes)?;
    let has_ftc_repo_root = zip_entries
        .iter()
        .any(|entry| entry.name.contains(FTC_REPO_TEAMCODE_SOURCE_ROOT));
    let archive_kind = if has_ftc_repo_root {
        "ftc_repo"
    } else {
        "teamcode_folder"
    };

    let mut seen_paths = HashSet::new();
    let mut files = Vec::new();

    for entry in zip_entries {
        let Some(relative_path) = teamcode_import_relative_path(&entry.name, has_ftc_repo_root)
        else {
            continue;
        };

        if !relative_path.ends_with(".java") {
            continue;
        }

        let relative_path = validate_teamcode_java_path(&relative_path)?
            .to_string_lossy()
            .replace('\\', "/");

        if seen_paths.insert(relative_path.clone()) {
            files.push(TeamCodeZipImportFile {
                relative_path,
                contents: entry.contents,
            });
        }
    }

    if files.is_empty() {
        return Err("No TeamCode Java files were found in this zip".into());
    }

    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok((archive_kind.to_string(), files))
}

fn github_repo_zip_url(repo_url: &str) -> Result<String, String> {
    let trimmed = repo_url.trim();
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let path = without_scheme
        .strip_prefix(&format!("{GITHUB_HOST}/"))
        .or_else(|| without_scheme.strip_prefix(&format!("www.{GITHUB_HOST}/")))
        .ok_or_else(|| "Enter a GitHub repo URL".to_string())?
        .trim_start_matches('/');
    let parts = path.split('/').collect::<Vec<_>>();

    if parts.len() < 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err("Enter a GitHub repo URL".into());
    }

    let owner = parts[0];
    let repo = parts[1]
        .split(['?', '#'])
        .next()
        .unwrap_or("")
        .trim_end_matches(".git");
    if repo.is_empty() {
        return Err("Enter a GitHub repo URL".into());
    }

    let archive_ref = if parts.get(2) == Some(&"tree") && parts.len() > 3 {
        format!("refs/heads/{}", parts[3..].join("/"))
    } else {
        "HEAD".to_string()
    };

    Ok(format!(
        "https://{GITHUB_HOST}/{owner}/{repo}/archive/{archive_ref}.zip"
    ))
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

#[tauri::command]
pub(crate) fn preview_teamcode_zip_import(
    archive_bytes: Vec<u8>,
) -> Result<TeamCodeZipImportPreview, String> {
    ensure_teamcode_workspace()?;
    let (archive_kind, files) = collect_teamcode_zip_import_files(&archive_bytes)?;
    let root = teamcode_root();
    let mut file_paths = Vec::new();
    let mut conflicts = Vec::new();

    for file in files {
        if root.join(&file.relative_path).exists() {
            conflicts.push(file.relative_path.clone());
        }
        file_paths.push(file.relative_path);
    }

    Ok(TeamCodeZipImportPreview {
        archive_kind,
        files: file_paths,
        conflicts,
    })
}

#[tauri::command]
pub(crate) fn import_teamcode_zip(
    archive_bytes: Vec<u8>,
    decisions: HashMap<String, TeamCodeZipImportDecision>,
    replace_all: bool,
) -> Result<String, String> {
    ensure_teamcode_workspace()?;
    let (_, files) = collect_teamcode_zip_import_files(&archive_bytes)?;
    let root = teamcode_root();
    let mut imported_count = 0usize;
    let mut skipped_count = 0usize;

    for file in files {
        let existing_path = root.join(&file.relative_path);
        let destination_relative_path = if existing_path.exists() {
            if replace_all {
                file.relative_path.clone()
            } else {
                let Some(decision) = decisions.get(&file.relative_path) else {
                    return Err(format!(
                        "Missing import decision for {}",
                        file.relative_path
                    ));
                };

                match decision.action.as_str() {
                    "replace" => file.relative_path.clone(),
                    "skip" => {
                        skipped_count += 1;
                        continue;
                    }
                    "rename" => {
                        let rename_path = decision.rename_path.as_deref().ok_or_else(|| {
                            format!("Missing rename path for {}", file.relative_path)
                        })?;
                        let rename_path = validate_teamcode_java_path(rename_path)?
                            .to_string_lossy()
                            .replace('\\', "/");
                        if root.join(&rename_path).exists() {
                            return Err(format!("{rename_path} already exists"));
                        }
                        rename_path
                    }
                    _ => return Err("Invalid conflict decision".into()),
                }
            }
        } else {
            file.relative_path.clone()
        };

        let destination_path = root.join(destination_relative_path);
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(destination_path, file.contents).map_err(|e| e.to_string())?;
        imported_count += 1;
    }

    Ok(format!(
        "Imported {imported_count} TeamCode file{}{}",
        if imported_count == 1 { "" } else { "s" },
        if skipped_count > 0 {
            format!(", skipped {skipped_count}")
        } else {
            String::new()
        }
    ))
}

#[tauri::command]
pub(crate) async fn download_github_teamcode_zip(repo_url: String) -> Result<Vec<u8>, String> {
    let zip_url = github_repo_zip_url(&repo_url)?;
    let response = reqwest::Client::new()
        .get(&zip_url)
        .header("User-Agent", "FTC-Sim")
        .send()
        .await
        .map_err(|error| format!("Failed to download GitHub repo: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub repo download failed with status {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read GitHub repo zip: {error}"))?;

    Ok(bytes.to_vec())
}

#[tauri::command]
pub(crate) fn export_teamcode_zip(app: AppHandle) -> Result<String, String> {
    ensure_teamcode_workspace()?;

    let export_path = app
        .path()
        .download_dir()
        .map_err(|error| format!("Failed to find Downloads folder: {error}"))?
        .join("TeamCode.zip");

    if let Some(parent) = export_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut zip_file = fs::File::create(&export_path).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    let root = teamcode_root();

    write_zip_entry(
        &mut zip_file,
        TEAMCODE_EXPORT_ROOT.to_string(),
        &[],
        true,
        &mut entries,
    )?;
    add_teamcode_directory_to_zip(&mut zip_file, &root, &root, &mut entries)?;
    finish_zip(&mut zip_file, &entries)?;

    Ok(export_path.to_string_lossy().to_string())
}
