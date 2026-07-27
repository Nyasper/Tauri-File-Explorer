export interface SidebarNode {
  name: string;
  path: string;
  isExpanded: boolean;
  hasSubfolders: boolean;
  children: SidebarNode[] | null;
  isLoading: boolean;
  /** True for user-pinned entries; false (omitted) for system roots/drives. */
  userAdded?: boolean;
}

export interface SystemPathEntry {
  name: string;
  path: string;
  has_subfolders: boolean;
}

export interface SidebarFolder {
  name: string;
  path: string;
  has_subfolders: boolean;
}

export interface DriveEntry {
  name: string;
  path: string;
  has_subfolders: boolean;
}
