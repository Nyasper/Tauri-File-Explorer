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
