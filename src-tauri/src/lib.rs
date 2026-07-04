use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct DirEntry {
    name: String,
    is_dir: bool,
    is_file: bool,
    size: u64,
    readonly: bool,
}

#[tauri::command]
fn get_chara(chara_name: &str) -> String {
    format!("Obteniendo Chara: {}", chara_name)
}

#[tauri::command]
fn list_dir(path: &str) -> Result<Vec<DirEntry>, String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("La ruta no existe: {}", path.display()));
    }
    if !path.is_dir() {
        return Err(format!("La ruta no es un directorio: {}", path.display()));
    }

    let entries = fs::read_dir(path).map_err(|e| format!("Error al leer el directorio: {}", e))?;

    let mut result: Vec<DirEntry> = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Error leyendo entrada: {}", e);
                continue;
            }
        };
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                eprintln!("Error leyendo metadata de {:?}: {}", entry.path(), e);
                continue;
            }
        };
        let name = entry.file_name().to_string_lossy().to_string();
        result.push(DirEntry {
            name,
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            size: metadata.len(),
            readonly: metadata.permissions().readonly(),
        });
    }

    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_chara, list_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}