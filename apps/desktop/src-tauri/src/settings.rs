use std::{fs, path::PathBuf};

use tauri::{AppHandle, Manager};

const GAMEPAD_MAPPING_FILE_NAME: &str = "gamepad-mapping.json";

fn gamepad_mapping_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to find app data directory: {error}"))?;

    Ok(app_data_dir.join(GAMEPAD_MAPPING_FILE_NAME))
}

#[tauri::command]
pub fn read_gamepad_mapping(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = gamepad_mapping_path(&app)?;

    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read gamepad mapping: {error}"))?;
    let mapping = serde_json::from_str(&contents)
        .map_err(|error| format!("Failed to parse gamepad mapping: {error}"))?;

    Ok(Some(mapping))
}

#[tauri::command]
pub fn save_gamepad_mapping(app: AppHandle, mapping: serde_json::Value) -> Result<(), String> {
    let path = gamepad_mapping_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Failed to find gamepad mapping directory".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create app data directory: {error}"))?;

    let contents = serde_json::to_string_pretty(&mapping)
        .map_err(|error| format!("Failed to serialize gamepad mapping: {error}"))?;
    fs::write(&path, contents)
        .map_err(|error| format!("Failed to save gamepad mapping: {error}"))?;

    Ok(())
}
