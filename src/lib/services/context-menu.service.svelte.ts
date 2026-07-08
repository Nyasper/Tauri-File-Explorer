export type ContextMenuItem =
  | {
      label: string;
      icon?: string;
      shortcut?: string;
      disabled?: boolean;
      action: () => void | Promise<void>;
      isSeparator?: never;
    }
  | {
      isSeparator: true;
      label?: never;
      icon?: never;
      shortcut?: never;
      disabled?: never;
      action?: never;
    };

export type ContextMenuType = "file" | "folder" | "empty" | "tab";

export class ContextMenuService {
  isOpen = $state(false);
  position = $state({ x: 0, y: 0 });
  type: ContextMenuType | null = $state(null);
  items: ContextMenuItem[] = $state([]);

  show(e: MouseEvent, type: ContextMenuType, items: ContextMenuItem[]) {
    e.preventDefault();
    e.stopPropagation();

    this.position = { x: e.clientX, y: e.clientY };
    this.type = type;
    this.items = items;
    this.isOpen = true;

    window.addEventListener("click", this.close);
    window.addEventListener("contextmenu", this.closeOutside);
  }

  close = () => {
    this.isOpen = false;
    window.removeEventListener("click", this.close);
    window.removeEventListener("contextmenu", this.closeOutside);
  };

  private closeOutside = (e: MouseEvent) => {
    e.preventDefault();
    this.close();
  };
}

export const contextMenu = new ContextMenuService();
