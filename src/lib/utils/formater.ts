export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  // Clamp to the largest known unit so PB+ sizes don't yield "undefined".
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  );
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Returns the name to display for a file system entry. When `showExtensions`
 * is false, the trailing ".ext" is stripped from file names. Directories are
 * never truncated since dots are valid characters in folder names.
 */
export function formatDisplayName(
  name: string,
  isDir: boolean,
  showExtensions: boolean,
): string {
  if (isDir || showExtensions) return name;
  const dotIndex = name.lastIndexOf(".");
  // Ignore leading dots (e.g. ".gitignore" has no extension to hide)
  if (dotIndex <= 0) return name;
  return name.slice(0, dotIndex);
}
