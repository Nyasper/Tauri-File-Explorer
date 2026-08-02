import { invoke, Channel } from "@tauri-apps/api/core";
import type { FileEntry } from "./types/explorer.types";
import type { SidebarFolder, SystemPathEntry, DriveEntry } from "./types/sidebar.types";


/**
 * Lists the contents of the directory at the specified path.
 * Sorts directories first, then files alphabetically.
 */
export async function listDir(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_dir", { path });
}

/**
 * Streams the contents of the directory at the specified path in chunks,
 * invoking `onChunk` for each batch of entries as it is read from disk
 * (raw disk order, unsorted). Resolves with the total number of entries
 * once the stream completes.
 */
export async function listDirStream(
  path: string,
  onChunk: (entries: FileEntry[]) => void,
): Promise<number> {
  const channel = new Channel<FileEntry[]>();
  channel.onmessage = onChunk;
  return invoke<number>("list_dir_stream", { path, onChunk: channel });
}

/**
 * Cancels any in-flight directory stream for the specified path.
 * Instant and harmless when no stream is running.
 */
export async function cancelDirStream(path: string): Promise<void> {
  return invoke<void>("cancel_dir_stream", { path });
}

/**
 * Creates a file or directory at the specified path.
 */
export async function createFile(path: string, isDir: boolean): Promise<void> {
  return invoke<void>("create_file", { path, isDir });
}

/**
 * Renames/moves a file or directory from oldPath to newPath.
 */
export async function renameFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  return invoke<void>("rename_file", { oldPath, newPath });
}

/**
 * Deletes a file or directory at the specified path.
 */
export async function deleteFile(path: string): Promise<void> {
  return invoke<void>("delete_file", { path });
}

/**
 * Copies a file or directory (recursively) from src to dest.
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  return invoke<void>("copy_file", { src, dest });
}

/**
 * Moves a file or directory from src to dest.
 * Supports cross-filesystem fallbacks automatically.
 */
export async function moveFile(src: string, dest: string): Promise<void> {
  return invoke<void>("move_file", { src, dest });
}

/**
 * Opens a file with the system default application.
 */
export async function openFile(path: string): Promise<void> {
  return invoke<void>("open_file", { path });
}

/**
 * Performs a fast, indexed search for files and folders under rootPath.
 */
export async function searchIndex(
  query: string,
  rootPath: string,
): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("search_index", { query, rootPath });
}

/**
 * Gets the current user's home directory path.
 */
export async function getHomeDir(): Promise<string> {
  return invoke<string>("get_home_dir");
}

/**
 * Gets the list of common system paths (Desktop, Documents, Downloads, etc.).
 */
export async function getSystemPaths(): Promise<SystemPathEntry[]> {
  return invoke<SystemPathEntry[]>("get_system_paths");
}

/**
 * Lists subdirectories of the specified directory.
 */
export async function listSidebarFolders(path: string): Promise<SidebarFolder[]> {
  return invoke<SidebarFolder[]>("list_sidebar_folders", { path });
}

/**
 * Gets the list of available system disk drives.
 */
export async function getSystemDrives(): Promise<DriveEntry[]> {
  return invoke<DriveEntry[]>("get_system_drives");
}

/**
 * Gets the native Recycle Bin / Trash path for in-app navigation.
 */
export async function getRecycleBinPath(): Promise<string> {
  return invoke<string>("get_recycle_bin_path");
}

/**
 * Empties the Recycle Bin / Trash.
 */
export async function emptyRecycleBin(): Promise<void> {
  return invoke<void>("empty_recycle_bin");
}

