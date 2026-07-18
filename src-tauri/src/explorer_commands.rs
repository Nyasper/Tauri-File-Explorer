use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use tauri_plugin_opener::OpenerExt;
use tauri::Manager;

#[cfg(windows)]
extern "system" {
    fn SHEmptyRecycleBinW(
        hwnd: isize,
        pszRootPath: *const u16,
        dwFlags: u32,
    ) -> i32;
}

#[cfg(windows)]
const SHERB_NOCONFIRMATION: u32 = 0x00000001;
#[cfg(windows)]
const SHERB_NOPROGRESSUI: u32 = 0x00000002;
#[cfg(windows)]
const SHERB_NOSOUND: u32 = 0x00000004;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64, // Unix timestamp in milliseconds
    pub readonly: bool,
    pub permissions: Option<String>,
    pub extension: Option<String>,
    pub is_hidden: bool,
}

/// Cross-platform hidden-file detection: dot-prefixed names count as hidden on
/// every platform; on Windows the FILE_ATTRIBUTE_HIDDEN flag is also honored.
/// Works with both std::fs::Metadata and tokio::fs::Metadata since both
/// implement the platform MetadataExt trait.
#[cfg(windows)]
fn is_hidden_entry(name: &str, metadata: &impl std::os::windows::fs::MetadataExt) -> bool {
    name.starts_with('.') || (metadata.file_attributes() & 0x2) != 0 // FILE_ATTRIBUTE_HIDDEN
}

#[cfg(not(windows))]
fn is_hidden_entry<T>(name: &str, _metadata: &T) -> bool {
    name.starts_with('.')
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

// Helper to recursively copy directories asynchronously with tokio.
// Uses a semaphore to bound concurrent file I/O so we don't saturate the OS
// scheduler / disk queue when copying very large directory trees.
const MAX_CONCURRENT_COPIES: usize = 32;

// Boxed + Send future wrapper so recursion remains Send across tokio::spawn.
fn copy_dir_all(
    src: std::path::PathBuf,
    dst: std::path::PathBuf,
    sem: std::sync::Arc<tokio::sync::Semaphore>,
) -> std::pin::Pin<std::boxed::Box<dyn std::future::Future<Output = std::io::Result<()>> + Send>> {
    std::boxed::Box::pin(copy_dir_all_impl(src, dst, sem))
}

async fn copy_dir_all_impl(src: std::path::PathBuf, dst: std::path::PathBuf, sem: std::sync::Arc<tokio::sync::Semaphore>) -> std::io::Result<()> {
    tokio::fs::create_dir_all(&dst).await?;

    let mut reader = tokio::fs::read_dir(&src).await?;
    let mut subdir_tasks: Vec<tokio::task::JoinHandle<std::io::Result<()>>> = Vec::new();
    let mut file_tasks: Vec<tokio::task::JoinHandle<std::io::Result<()>>> = Vec::new();

    while let Some(entry) = reader.next_entry().await? {
        let file_type = entry.file_type().await?;
        let dst_entry = dst.join(entry.file_name());
        if file_type.is_dir() {
            let src_sub = entry.path();
            let sem_clone = std::sync::Arc::clone(&sem);
            subdir_tasks.push(tokio::task::spawn(copy_dir_all(src_sub, dst_entry, sem_clone)));
        } else {
            let src_file = entry.path();
            let permit = std::sync::Arc::clone(&sem);
            file_tasks.push(tokio::task::spawn(async move {
                let _p = permit.acquire_owned().await.expect("semaphore closed");
                tokio::fs::copy(&src_file, &dst_entry)
                    .await
                    .map(|_| ())
            }));
        }
    }

    // Await all file copies first
    for t in file_tasks {
        t.await
            .map_err(|e| std::io::Error::other(format!("copy task panicked: {e}")))??;
    }
    // Then await all subdirectory recursions
    for t in subdir_tasks {
        t.await
            .map_err(|e| std::io::Error::other(format!("subdir task panicked: {e}")))??;
    }
    Ok(())
}



// Async helper to index directories. Returns the collected entries instead of
// mutating a shared buffer so the recursion composes cleanly across spawned
// futures.
async fn build_index_recursive(root: std::path::PathBuf, current_depth: u32, max_entries: usize) -> Vec<FileEntry> {
    let mut entries: Vec<FileEntry> = Vec::new();
    if current_depth > 5 {
        return entries;
    }

    let mut reader = match tokio::fs::read_dir(&root).await {
        Ok(r) => r,
        Err(_) => return entries,
    };

    let mut subdirs: Vec<std::path::PathBuf> = Vec::new();

    while let Ok(Some(entry)) = reader.next_entry().await {
        if entries.len() >= max_entries {
            break;
        }
        if let Ok(file_type) = entry.file_type().await {
            if file_type.is_symlink() {
                continue;
            }
        }
        if let Ok(metadata) = entry.metadata().await {
            let name = entry.file_name().to_string_lossy().to_string();
            let path_str = entry.path().to_string_lossy().to_string();
            let modified = metadata.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let is_dir = metadata.is_dir();
            let is_hidden = is_hidden_entry(&name, &metadata);

            entries.push(FileEntry {
                name,
                path: path_str,
                is_dir,
                size: metadata.len(),
                modified,
                readonly: metadata.permissions().readonly(),
                permissions: Some(get_permissions_string(&metadata)),
                extension: entry.path().extension().map(|e| e.to_string_lossy().to_string()),
                is_hidden,
            });

            if is_dir {
                subdirs.push(entry.path());
            }
        }
    }

    // Recurse into subdirectories concurrently
    let futures: Vec<_> = subdirs
        .into_iter()
        .map(|p| build_index_recursive(p, current_depth + 1, max_entries.saturating_sub(entries.len())))
        .collect();
    let sub_results = futures::future::join_all(futures).await;
    for mut sub in sub_results {
        let remaining = max_entries.saturating_sub(entries.len());
        if remaining == 0 {
            break;
        }
        if sub.len() > remaining {
            sub.truncate(remaining);
        }
        entries.append(&mut sub);
    }

    entries
}

pub fn index_directory_in_background(path: String) {
    tauri::async_runtime::spawn(async move {
        // Index up to 5000 files recursively
        let entries = build_index_recursive(std::path::PathBuf::from(&path), 0, 5000).await;

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

        let is_hidden = is_hidden_entry(&name, &metadata);

        result.push(FileEntry {
            name,
            path: path_str,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
            readonly: metadata.permissions().readonly(),
            permissions: Some(get_permissions_string(&metadata)),
            extension: entry.path().extension().map(|e| e.to_string_lossy().to_string()),
            is_hidden,
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
pub async fn copy_file(src: String, dest: String) -> Result<(), String> {
    let src_ref = Path::new(&src);
    let dest_ref = Path::new(&dest);

    if !src_ref.exists() {
        return Err(format!("Source path does not exist: {}", src));
    }

    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_COPIES));

    if src_ref.is_dir() {
        copy_dir_all(
            std::path::PathBuf::from(&src),
            std::path::PathBuf::from(&dest),
            sem,
        )
        .await
        .map_err(|e| format!("Failed to copy directory recursively: {}", e))?;
    } else {
        if let Some(parent) = dest_ref.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create destination parent folder: {}", e))?;
        }
        tokio::fs::copy(src_ref, dest_ref)
            .await
            .map_err(|e| format!("Failed to copy file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn move_file(src: String, dest: String) -> Result<(), String> {
    let src_ref = Path::new(&src);
    let dest_ref = Path::new(&dest);

    if !src_ref.exists() {
        return Err(format!("Source path does not exist: {}", src));
    }

    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_COPIES));

    // Try rename first (fast moving on same device)
    if tokio::fs::rename(src_ref, dest_ref).await.is_err() {
        // Fallback: Copy and then delete source
        if src_ref.is_dir() {
            copy_dir_all(
                std::path::PathBuf::from(&src),
                std::path::PathBuf::from(&dest),
                sem,
            )
            .await
            .map_err(|e| format!("Failed to copy directory for move: {}", e))?;
            tokio::fs::remove_dir_all(src_ref)
                .await
                .map_err(|e| format!("Failed to delete original directory after move: {}", e))?;
        } else {
            if let Some(parent) = dest_ref.parent() {
                tokio::fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Failed to create destination parent folder: {}", e))?;
            }
            tokio::fs::copy(src_ref, dest_ref)
                .await
                .map_err(|e| format!("Failed to copy file for move: {}", e))?;
            tokio::fs::remove_file(src_ref)
                .await
                .map_err(|e| format!("Failed to delete original file after move: {}", e))?;
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
pub async fn search_index(query: String, root_path: String) -> Result<Vec<FileEntry>, String> {
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

    // 2. Fallback to direct async walk if not found or empty
    let root = Path::new(&root_path);
    if !root.exists() {
        return Err(format!("The search path does not exist: {}", root_path));
    }

    let mut results = search_dir_recursive(std::path::PathBuf::from(&root_path), query_lower.clone()).await;
    if results.len() > 500 {
        results.truncate(500);
    }

    // 3. Index it in the background for next time
    index_directory_in_background(root_path);

    Ok(results)
}

// Async recursive directory search. Returns up to `cap` matches; recursion
// returns early once the cap is reached. Uses join_all so sibling directories
// are scanned concurrently.
async fn search_dir_recursive(root: std::path::PathBuf, query_lower: String) -> Vec<FileEntry> {
    const CAP: usize = 500;
    let mut results: Vec<FileEntry> = Vec::new();

    let mut reader = match tokio::fs::read_dir(&root).await {
        Ok(r) => r,
        Err(_) => return results,
    };

    let mut subdirs: Vec<std::path::PathBuf> = Vec::new();

    while let Ok(Some(entry)) = reader.next_entry().await {
        if results.len() >= CAP {
            break;
        }

        if let Ok(file_type) = entry.file_type().await {
            if file_type.is_symlink() {
                continue; // Skip symlinks
            }
        }

        if let Ok(metadata) = entry.metadata().await {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.to_lowercase().contains(&query_lower) {
                let path_str = entry.path().to_string_lossy().to_string();
                let modified = metadata.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                let is_hidden = is_hidden_entry(&name, &metadata);

                results.push(FileEntry {
                    name,
                    path: path_str,
                    is_dir: metadata.is_dir(),
                    size: metadata.len(),
                    modified,
                    readonly: metadata.permissions().readonly(),
                    permissions: Some(get_permissions_string(&metadata)),
                    extension: entry.path().extension().map(|e| e.to_string_lossy().to_string()),
                    is_hidden,
                });
            }

            if metadata.is_dir() {
                subdirs.push(entry.path());
            }
        }
    }

    if results.len() >= CAP {
        return results;
    }

    // Recurse into subdirectories concurrently. The caller truncates to the
    // global cap (500) after merging all results.
    let futures: Vec<_> = subdirs
        .into_iter()
        .map(|p| search_dir_recursive(p, query_lower.clone()))
        .collect();
    let sub_results = futures::future::join_all(futures).await;
    for mut sub in sub_results {
        if results.len() >= CAP {
            break;
        }
        results.append(&mut sub);
    }

    results
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SidebarFolder {
    pub name: String,
    pub path: String,
    pub has_subfolders: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemPathEntry {
    pub name: String,
    pub path: String,
    pub has_subfolders: bool,
}

fn has_subfolders_helper(path: &std::path::Path) -> bool {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') {
                    continue; // Ignore hidden files/folders starting with dot
                }
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if let Ok(metadata) = entry.metadata() {
                        if (metadata.file_attributes() & 0x2) != 0 { // FILE_ATTRIBUTE_HIDDEN
                            continue;
                        }
                    }
                }
                // Only count sub-directories: plain files shouldn't trigger the
                // "has_subfolders" chevron (the field is used to decide if a
                // sidebar node is expandable).
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        return true;
                    }
                }
            }
        }
    }
    false
}

#[tauri::command]
pub fn get_home_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to resolve home directory: {}", e))
}

#[tauri::command]
pub fn get_system_paths(app: tauri::AppHandle) -> Result<Vec<SystemPathEntry>, String> {
    let path_resolver = app.path();
    let mut paths = Vec::new();

    let dirs = [
        ("Home", path_resolver.home_dir()),
        ("Desktop", path_resolver.desktop_dir()),
        ("Documents", path_resolver.document_dir()),
        ("Downloads", path_resolver.download_dir()),
        ("Images", path_resolver.picture_dir()),
        ("Videos", path_resolver.video_dir()),
        ("Music", path_resolver.audio_dir()),
    ];

    for (name, dir_result) in dirs {
        if let Ok(dir_path) = dir_result {
            let path_str = dir_path.to_string_lossy().to_string();
            let has_subfolders = has_subfolders_helper(&dir_path);
            paths.push(SystemPathEntry {
                name: name.to_string(),
                path: path_str,
                has_subfolders,
            });
        }
    }

    Ok(paths)
}

#[tauri::command]
pub fn list_sidebar_folders(path: String) -> Result<Vec<SidebarFolder>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("The path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("The path is not a directory: {}", path));
    }

    let entries = fs::read_dir(root).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut folders = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    let path_str = entry.path().to_string_lossy().to_string();
                    let name = entry.file_name().to_string_lossy().to_string();
                    let has_sub = has_subfolders_helper(&entry.path());
                    
                    folders.push(SidebarFolder {
                        name,
                        path: path_str,
                        has_subfolders: has_sub,
                    });
                }
            }
        }
    }

    // Sort alphabetically (case-insensitive)
    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(folders)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DriveEntry {
    pub name: String,
    pub path: String,
    pub has_subfolders: bool,
}

#[tauri::command]
pub fn get_system_drives() -> Result<Vec<DriveEntry>, String> {
    let mut drives = Vec::new();
    #[cfg(windows)]
    {
        for c in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", c as char);
            let path = std::path::Path::new(&drive_path);
            if path.exists() {
                let name = format!("Disk ({}:)", c as char);
                let has_subfolders = has_subfolders_helper(path);
                drives.push(DriveEntry {
                    name,
                    path: drive_path,
                    has_subfolders,
                });
            }
        }
    }
    #[cfg(not(windows))]
    {
        let drive_path = "/".to_string();
        let path = std::path::Path::new(&drive_path);
        let has_subfolders = has_subfolders_helper(path);
        drives.push(DriveEntry {
            name: "Root (/)".to_string(),
            path: drive_path,
            has_subfolders,
        });
    }
    Ok(drives)
}

#[tauri::command]
pub fn get_recycle_bin_path() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // The Windows Recycle Bin virtual folder path
        let recycle_path = "C:\\$Recycle.Bin";
        let path = std::path::Path::new(recycle_path);
        if path.exists() {
            return Ok(recycle_path.to_string());
        }
        // Fallback: try each drive's recycle bin
        for c in b'A'..=b'Z' {
            let drive_recycle = format!("{}:\\$Recycle.Bin", c as char);
            if std::path::Path::new(&drive_recycle).exists() {
                return Ok(drive_recycle);
            }
        }
        Err("Could not find Recycle Bin path".to_string())
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let trash_path = format!("{}/.Trash", home);
            return Ok(trash_path);
        }
        Err("Could not find Trash path".to_string())
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            // Standard freedesktop trash location
            let trash_path = format!("{}/.local/share/Trash/files", home);
            let path = std::path::Path::new(&trash_path);
            if path.exists() {
                return Ok(trash_path);
            }
            // Fallback
            let trash_path2 = format!("{}/.Trash", home);
            return Ok(trash_path2);
        }
        Err("Could not find Trash path".to_string())
    }
}

#[tauri::command]
pub fn empty_recycle_bin() -> Result<(), String> {
    #[cfg(windows)]
    {
        let result = unsafe {
            SHEmptyRecycleBinW(
                0,
                std::ptr::null(),
                SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
            )
        };
        if result != 0 {
            return Err(format!("Failed to empty Recycle Bin (error code: {})", result));
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let trash_path = format!("{}/.Trash", home);
            if std::path::Path::new(&trash_path).exists() {
                std::fs::remove_dir_all(&trash_path)
                    .map_err(|e| format!("Failed to empty Trash: {}", e))?;
                std::fs::create_dir(&trash_path).unwrap_or(());
            }
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Ok(home) = std::env::var("HOME") {
            for sub in &["files", "info", "expunged"] {
                let trash_path = format!("{}/.local/share/Trash/{}", home, sub);
                let p = std::path::Path::new(&trash_path);
                if p.exists() {
                    std::fs::remove_dir_all(p)
                        .map_err(|e| format!("Failed to empty Trash: {}", e))?;
                    std::fs::create_dir(p).unwrap_or(());
                }
            }
        }
    }

    Ok(())
}


