/**
 * Normalizes file paths for reliable comparison across Windows, macOS, and Linux.
 * Replaces backslashes with forward slashes and trims whitespace.
 */
export function normalizePath(p: string): string {
  if (!p) return "";
  let normalized = p.replace(/\\/g, "/").trim();
  
  // Remove trailing slash except for root paths (e.g., "/" or "C:/")
  if (normalized.endsWith("/") && !normalized.endsWith(":/")) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Checks if a parent path is an ancestor (or equal to) a child path.
 */
export function isParentPath(parent: string, child: string): boolean {
  const normParent = normalizePath(parent);
  const normChild = normalizePath(child);
  
  if (normParent === normChild) {
    return true;
  }
  
  // Windows drive root (e.g., "D:/") already has a trailing slash; don't double it
  if (normParent.endsWith(":/")) {
    return normChild.startsWith(normParent);
  }
  
  return normChild.startsWith(normParent + "/");
}

/**
 * Returns the parent directory of `p`.
 *
 * - For Unix roots ("/") returns "" (no parent).
 * - For Windows drive roots ("C:\\" or "C:/") returns "" (no parent).
 * - Always normalizes separators so the result is consistent regardless
 *   of the source path's separator style.
 *
 * Examples:
 *   getParentPath("C:\\Users\\Foo")        -> "C:/Users"
 *   getParentPath("C:/Users/Foo/Bar")      -> "C:/Users/Foo"
 *   getParentPath("C:\\")                  -> "" (drive root)
 *   getParentPath("/")                      -> "" (unix root)
 *   getParentPath("/home/user")             -> "/home"
 */
export function getParentPath(p: string): string {
  if (!p) return "";

  const norm = normalizePath(p);

  // Unix root
  if (norm === "/") return "";

  // Windows drive root, e.g. "C:/" or "C:"
  if (/^[A-Za-z]:\/?$/.test(norm)) return "";

  // Windows drive-level path: e.g. "C:/Users" -> "C:/"
  const driveMatch = norm.match(/^([A-Za-z]:)\/(.+)$/);
  if (driveMatch) {
    const drive = driveMatch[1];
    const rest = driveMatch[2];
    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 1) return `${drive}/`;
    return `${drive}/${parts.slice(0, -1).join("/")}`;
  }

  // Generic Unix-style path
  const parts = norm.split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return "/" + parts.slice(0, -1).join("/");
}
