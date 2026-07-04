pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_dir,
            commands::create_file,
            commands::rename_file,
            commands::delete_file,
            commands::copy_file,
            commands::move_file,
            commands::open_file,
            commands::search_index,
            commands::calculate_folder_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}