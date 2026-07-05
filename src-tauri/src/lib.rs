pub mod explorer_commands;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            explorer_commands::list_dir,
            explorer_commands::create_file,
            explorer_commands::rename_file,
            explorer_commands::delete_file,
            explorer_commands::copy_file,
            explorer_commands::move_file,
            explorer_commands::open_file,
            explorer_commands::search_index,
            utils::sleep,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}