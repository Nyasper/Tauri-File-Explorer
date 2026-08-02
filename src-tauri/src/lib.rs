pub mod explorer_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            explorer_commands::list_dir,
            explorer_commands::list_dir_stream,
            explorer_commands::cancel_dir_stream,
            explorer_commands::create_file,
            explorer_commands::rename_file,
            explorer_commands::delete_file,
            explorer_commands::copy_file,
            explorer_commands::move_file,
            explorer_commands::open_file,
            explorer_commands::search_index,
            explorer_commands::get_home_dir,
            explorer_commands::get_system_paths,
            explorer_commands::list_sidebar_folders,
            explorer_commands::get_system_drives,
            explorer_commands::get_recycle_bin_path,
            explorer_commands::empty_recycle_bin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}