#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod paths;
mod runner;
mod settings;
mod teamcode;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_| {
            runner::start_sim_runner_background(false);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            teamcode::save_teamcode_file,
            teamcode::create_teamcode_file,
            teamcode::create_teamcode_folder,
            teamcode::rename_teamcode_file,
            teamcode::rename_teamcode_folder,
            teamcode::delete_teamcode_file,
            teamcode::delete_teamcode_folder,
            teamcode::list_teamcode_files,
            teamcode::list_teamcode_directories,
            teamcode::read_teamcode_file,
            teamcode::preview_teamcode_zip_import,
            teamcode::import_teamcode_zip,
            teamcode::download_github_teamcode_zip,
            teamcode::export_teamcode_zip,
            settings::read_gamepad_mapping,
            settings::save_gamepad_mapping,
            runner::read_runner_log,
            runner::restart_sim_runner
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
