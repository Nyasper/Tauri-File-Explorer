use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use tauri::Emitter;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
    pub modified: u64, // Unix timestamp in milliseconds
    pub readonly: bool,
    pub permissions: Option<String>,
    pub extension: Option<String>,
}

// Global in-memory search index for quick search capability
static SEARCH_INDEX: OnceLock<Mutex<HashMap<String, Vec<FileEntry>>>> = OnceLock::new();

fn get_search_index() -> &'static Mutex<HashMap<String, Vec<FileEntry>>> {
    SEARCH_INDEX.get_or_init(|| Mutex::new(HashMap::new()))
}

// Cross-platform helper to extract permissions as a string representation
#[cfg(unix)]
fn get_permissions_string(metadata: &fs::Metadata) -> String {
    use std::os::unix::fs::PermissionsExt;
    let mode = metadata.permissions().mode();
    let is_dir = metadata.is_dir();

    let type_char = if is_dir { 'd' } else { '-' };
    let mut s = String::new();
    s.push(type_char);

    let chars = ['r', 'w', 'x'];
    for i in (0..9).rev() {
        if (mode >> i) & 1 == 1 {
            s.push(chars[(8 - i) % 3]);
        } else {
            s.push('-');
        }
    }
    s
}

#[cfg(not(unix))]
fn get_permissions_string(metadata: &fs::Metadata) -> String {
    let permissions = metadata.permissions();
    if permissions.readonly() {
        "R-".to_string()
    } else {
        "RW".to_string()
    }
}

// Helper to recursively copy directories
fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

// Helper to recursively compute folder size
fn get_dir_size_recursive(path: &Path) -> u64 {
    let mut total_size = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_symlink() {
                    continue; // Skip symlinks to avoid cycles/infinite recursion
                }
            }
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    total_size += get_dir_size_recursive(&entry.path());
                } else {
                    total_size += metadata.len();
                }
            }
        }
    }
    total_size
}

// Helper to index directories in the background
fn build_index_recursive(root: &Path, entries: &mut Vec<FileEntry>, current_depth: u32, max_entries: usize) {
    if entries.len() >= max_entries || current_depth > 5 {
        return;
    }
    if let Ok(dir_entries) = fs::read_dir(root) {
        for entry in dir_entries.flatten() {
            if entries.len() >= max_entries {
                return;
            }
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_symlink() {
                    continue;
                }
            }
            if let Ok(metadata) = entry.metadata() {
                let name = entry.file_name().to_string_lossy().to_string();
                let path_str = entry.path().to_string_lossy().to_string();
                let modified = metadata.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                let is_dir = metadata.is_dir();

                entries.push(FileEntry {
                    name,
                    path: path_str,
                    is_dir,
                    is_file: metadata.is_file(),
                    size: metadata.len(),
                    modified,
                    readonly: metadata.permissions().readonly(),
                    permissions: Some(get_permissions_string(&metadata)),
                    extension: entry.path().extension().map(|e| e.to_string_lossy().to_string()),
                });

                if is_dir {
                    build_index_recursive(&entry.path(), entries, current_depth + 1, max_entries);
                }
            }
        }
    }
}

pub fn index_directory_in_background(path: String) {
    std::thread::spawn(move || {
        let root = Path::new(&path);
        let mut entries = Vec::new();
        // Index up to 5000 files recursively
        build_index_recursive(root, &mut entries, 0, 5000);

        if let Ok(mut index) = get_search_index().lock() {
            index.insert(path, entries);
        }
    });
}

// --- Tauri Commands ---

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(&path);

    if !root.exists() {
        return Err(format!("The path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("The path is not a directory: {}", path));
    }

    let entries = fs::read_dir(root).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut result: Vec<FileEntry> = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Error reading entry: {}", e);
                continue;
            }
        };

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                eprintln!("Error reading metadata for {:?}: {}", entry.path(), e);
                continue;
            }
        };

        let name = entry.file_name().to_string_lossy().to_string();
        let path_str = entry.path().to_string_lossy().to_string();
        let modified = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        result.push(FileEntry {
            name,
            path: path_str,
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            size: metadata.len(),
            modified,
            readonly: metadata.permissions().readonly(),
            permissions: Some(get_permissions_string(&metadata)),
            extension: entry.path().extension().map(|e| e.to_string_lossy().to_string()),
        });
    }

    // Sort: directories first, then files (alphabetically case-insensitive)
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    // Automatically trigger indexing in the background for faster search inside this directory
    index_directory_in_background(path);

    Ok(result)
}

#[tauri::command]
pub fn create_file(path: String, is_dir: bool) -> Result<(), String> {
    let path_ref = Path::new(&path);
    if let Some(parent) = path_ref.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    if is_dir {
        fs::create_dir_all(path_ref).map_err(|e| format!("Failed to create directory: {}", e))?;
    } else {
        fs::File::create(path_ref).map_err(|e| format!("Failed to create file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old_ref = Path::new(&old_path);
    let new_ref = Path::new(&new_path);
    fs::rename(old_ref, new_ref).map_err(|e| format!("Failed to rename/move item: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let path_ref = Path::new(&path);
    if !path_ref.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    trash::delete(path_ref).map_err(|e| format!("Failed to move item to Recycle Bin: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn copy_file(src: String, dest: String) -> Result<(), String> {
    let src_ref = Path::new(&src);
    let dest_ref = Path::new(&dest);

    if !src_ref.exists() {
        return Err(format!("Source path does not exist: {}", src));
    }

    if src_ref.is_dir() {
        copy_dir_all(src_ref, dest_ref).map_err(|e| format!("Failed to copy directory recursively: {}", e))?;
    } else {
        if let Some(parent) = dest_ref.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create destination parent folder: {}", e))?;
        }
        fs::copy(src_ref, dest_ref).map_err(|e| format!("Failed to copy file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn move_file(src: String, dest: String) -> Result<(), String> {
    let src_ref = Path::new(&src);
    let dest_ref = Path::new(&dest);

    if !src_ref.exists() {
        return Err(format!("Source path does not exist: {}", src));
    }

    // Try rename first (fast moving on same device)
    if fs::rename(src_ref, dest_ref).is_err() {
        // Fallback: Copy and then delete source
        if src_ref.is_dir() {
            copy_dir_all(src_ref, dest_ref).map_err(|e| format!("Failed to copy directory for move: {}", e))?;
            fs::remove_dir_all(src_ref).map_err(|e| format!("Failed to delete original directory after move: {}", e))?;
        } else {
            if let Some(parent) = dest_ref.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create destination parent folder: {}", e))?;
            }
            fs::copy(src_ref, dest_ref).map_err(|e| format!("Failed to copy file for move: {}", e))?;
            fs::remove_file(src_ref).map_err(|e| format!("Failed to delete original file after move: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| format!("Failed to open path: {}", e))
}

#[tauri::command]
pub fn search_index(query: String, root_path: String) -> Result<Vec<FileEntry>, String> {
    let query_lower = query.to_lowercase();

    // 1. Try to search in index first
    if let Ok(index) = get_search_index().lock() {
        if let Some(entries) = index.get(&root_path) {
            let matches: Vec<FileEntry> = entries
                .iter()
                .filter(|entry| entry.name.to_lowercase().contains(&query_lower))
                .cloned()
                .take(500)
                .collect();
            if !matches.is_empty() {
                return Ok(matches);
            }
        }
    }

    // 2. Fallback to direct walk if not found or empty
    let root = Path::new(&root_path);
    if !root.exists() {
        return Err(format!("The search path does not exist: {}", root_path));
    }

    let mut results = Vec::new();
    search_dir_recursive(root, &query_lower, &mut results);

    // 3. Index it in the background for next time
    index_directory_in_background(root_path);

    Ok(results)
}

fn search_dir_recursive(root: &Path, query_lower: &str, results: &mut Vec<FileEntry>) {
    if results.len() >= 500 {
        return; // cap results to avoid overloading
    }

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if results.len() >= 500 {
                return;
            }

            if let Ok(file_type) = entry.file_type() {
                if file_type.is_symlink() {
                    continue; // Skip symlinks
                }
            }

            if let Ok(metadata) = entry.metadata() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.to_lowercase().contains(query_lower) {
                    let path_str = entry.path().to_string_lossy().to_string();
                    let modified = metadata.modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);

                    results.push(FileEntry {
                        name,
                        path: path_str,
                        is_dir: metadata.is_dir(),
                        is_file: metadata.is_file(),
                        size: metadata.len(),
                        modified,
                        readonly: metadata.permissions().readonly(),
                        permissions: Some(get_permissions_string(&metadata)),
                        extension: entry.path().extension().map(|e| e.to_string_lossy().to_string()),
                    });
                }

                if metadata.is_dir() {
                    search_dir_recursive(&entry.path(), query_lower, results);
                }
            }
        }
    }
}

#[tauri::command]
pub fn calculate_folder_size(path: String, app: tauri::AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        let size = get_dir_size_recursive(Path::new(&path));
        #[derive(Serialize, Clone)]
        struct SizePayload {
            path: String,
            size: u64,
        }
        let _ = app.emit("folder-size-calculated", SizePayload { path, size });
    });
    Ok(())
}
