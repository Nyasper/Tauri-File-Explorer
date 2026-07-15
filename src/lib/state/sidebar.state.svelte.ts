import type { SidebarNode } from "../types/sidebar.types";
import * as explorerApi from "../explorer.api";
import { normalizePath, isParentPath } from "../utils/path.helper";

export class SidebarState {
  roots: SidebarNode[] = $state([]);
  drives: SidebarNode[] = $state([]);
  isInitialized = $state(false);

  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      // 1. Fetch system Quick Access paths
      const paths = await explorerApi.getSystemPaths();
      this.roots = paths.map((p) => ({
        name: p.name,
        path: p.path,
        isExpanded: false,
        hasSubfolders: p.has_subfolders,
        children: null,
        isLoading: false,
      }));

      // 2. Fetch PC storage drives
      const systemDrives = await explorerApi.getSystemDrives();
      this.drives = systemDrives.map((d) => ({
        name: d.name,
        path: d.path,
        isExpanded: false,
        hasSubfolders: d.has_subfolders,
        children: null,
        isLoading: false,
      }));

      this.isInitialized = true;
    } catch (err) {
      console.error("Failed to initialize sidebar folders and drives:", err);
      this.roots = [];
      this.drives = [];
    }
  }

  /**
   * Recursively traverses and expands nodes that lead to the active directory,
   * while collapsing other branches that are not part of the active path.
   */
  async expandToPath(activePath: string) {
    if (!activePath) return;
    const normActive = normalizePath(activePath);

    const processNodes = async (nodes: SidebarNode[]): Promise<boolean> => {
      let matchedAny = false;
      for (const node of nodes) {
        const normNode = normalizePath(node.path);

        if (isParentPath(normNode, normActive)) {
          matchedAny = true;
          node.isExpanded = true;

          // Load children dynamically if not loaded yet
          if (node.children === null && !node.isLoading && node.hasSubfolders) {
            await this.loadNodeChildren(node);
          }

          // Traverse down into loaded children
          if (node.children) {
            await processNodes(node.children);
          }
        } else {
          // Collapse other branches that do not belong to active ancestry
          node.isExpanded = false;
        }
      }
      return matchedAny;
    };

    await processNodes(this.roots);
    await processNodes(this.drives);
  }

  /**
   * Toggles the expanded state of a folder node manually.
   */
  async toggleNode(node: SidebarNode) {
    if (node.isExpanded) {
      node.isExpanded = false;
    } else {
      node.isExpanded = true;
      if (node.children === null && node.hasSubfolders) {
        await this.loadNodeChildren(node);
      }
    }
  }

  /**
   * Asynchronously loads the subfolders of a given node.
   */
  async loadNodeChildren(node: SidebarNode) {
    if (node.isLoading) return;
    node.isLoading = true;

    try {
      const subfolders = await explorerApi.listSidebarFolders(node.path);
      node.children = subfolders.map((f) => ({
        name: f.name,
        path: f.path,
        isExpanded: false,
        hasSubfolders: f.has_subfolders,
        children: null,
        isLoading: false,
      }));
      node.hasSubfolders = subfolders.length > 0;
    } catch (err) {
      console.error(`Failed to load subdirectories for ${node.path}:`, err);
      node.children = [];
    } finally {
      node.isLoading = false;
    }
  }

  /**
   * Find a node in the tree matching the target path.
   */
  findNodeByPath(path: string): SidebarNode | null {
    const normTarget = normalizePath(path);

    const search = (nodes: SidebarNode[]): SidebarNode | null => {
      for (const node of nodes) {
        if (normalizePath(node.path) === normTarget) {
          return node;
        }
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const inRoots = search(this.roots);
    if (inRoots) return inRoots;
    return search(this.drives);
  }

  /**
   * Refresh a path's node in the sidebar tree if it exists,
   * also refreshing its parent directory to catch newly added/removed folders.
   */
  async refreshPath(path: string) {
    const norm = normalizePath(path);

    // Refresh the folder itself
    const node = this.findNodeByPath(norm);
    if (node) {
      await this.loadNodeChildren(node);
    }

    // Refresh the parent directory
    const parentPath = this.getParentPath(norm);
    if (parentPath) {
      const parentNode = this.findNodeByPath(parentPath);
      if (parentNode) {
        await this.loadNodeChildren(parentNode);
      }
    }
  }

  /**
   * Helper to resolve the parent path.
   */
  getParentPath(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length <= 1) return "";

    if (path.includes(":")) {
      const drive = path.split(":")[0] + ":";
      if (parts.length === 2) return drive + "\\";
      return drive + "\\" + parts.slice(1, -1).join("\\");
    }

    return "/" + parts.slice(0, -1).join("/");
  }
}

// Global shared sidebar state singleton
export const sidebarState = new SidebarState();
