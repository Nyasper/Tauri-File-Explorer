import { explorerState } from "../state/explorer.state.svelte";

interface ShortcutItem {
  key: string;
  action: string;
  category: string;
}

export const globalShorcutsList: ShortcutItem[] = [
  { key: "Esc", action: "Close Modal Window", category: "System" },
  { key: "F1", action: "Toggle Help Modal Window", category: "System" },
  {
    key: "Ctrl + O",
    action: "Toggle Settings Modal Window",
    category: "System",
  },
  { key: "Ctrl + T", action: "New tab", category: "Tabs" },
  { key: "Ctrl + W", action: "Close current tab", category: "Tabs" },
  { key: "Right Click Tab", action: "Duplicate current tab", category: "Tabs" },
  {
    key: "Ctrl + Tab / Cmd + Tab",
    action: "Switch to next tab",
    category: "Tabs",
  },
  {
    key: "Ctrl + Shift + Tab / Cmd + Shift + Tab",
    action: "Switch to previous tab",
    category: "Tabs",
  },
  {
    key: "Alt + arrowleft",
    action: "Go back",
    category: "Tabs",
  },
  {
    key: "Alt + arrowright",
    action: "Go forward",
    category: "Tabs",
  },
  { key: "F5", action: "Refresh folder view", category: "Files" },
  { key: "F2", action: "Rename selected item", category: "Files" },
  { key: "Del", action: "Delete selected items", category: "Files" },
  { key: "Ctrl + C", action: "Copy selected items", category: "Files" },
  { key: "Ctrl + X", action: "Cut selected items", category: "Files" },
  { key: "Ctrl + V", action: "Paste clipboard items", category: "Files" },
] as const;

export function useKeybindingService() {
  console.debug("Keyboard Service initialized");
  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toLowerCase().includes("mac");
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // 1. Ctrl/Cmd + T -> New Tab (defaults to current tab path, or '/')
      if (ctrlKey && e.key.toLowerCase() === "t") {
        console.debug("New Tab shortcut pressed");
        e.preventDefault();
        const currentPath = explorerState.activeTab?.currentPath || "/";
        explorerState.addTab(currentPath);
        return;
      }

      // 2. Ctrl/Cmd + W -> Close Tab
      if (ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        console.debug("Close Tab shortcut pressed");
        explorerState.closeTab(explorerState.activeTabId);
        return;
      }

      // 3. Ctrl + Tab / Ctrl + Shift + Tab -> Switch Tabs
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        console.debug("Switch Tab shortcut pressed");
        const tabs = explorerState.tabs;
        if (tabs.length <= 1) return;

        const currentIndex = tabs.findIndex(
          (t) => t.id === explorerState.activeTabId,
        );
        if (currentIndex === -1) return;

        let nextIndex;
        if (e.shiftKey) {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else {
          nextIndex = (currentIndex + 1) % tabs.length;
        }
        explorerState.activeTabId = tabs[nextIndex].id;
        return;
      }

      // 4. Alt + ArrowLeft / Alt + ArrowRight (or Cmd + [ / Cmd + ] on Mac) -> Navigation History
      if (
        (e.altKey && e.key === "ArrowLeft") ||
        (isMac && e.metaKey && e.key === "[")
      ) {
        console.debug("Go Back shortcut pressed");
        // Skip if user is actively typing in an input or textarea
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        e.preventDefault();
        explorerState.goBack(
          explorerState.activeTabId,
          explorerState.activePaneSide,
        );
        return;
      }

      if (
        (e.altKey && e.key === "ArrowRight") ||
        (isMac && e.metaKey && e.key === "]")
      ) {
        console.debug("Go Forward shortcut pressed");
        // Skip if user is actively typing in an input or textarea
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        e.preventDefault();
        explorerState.goForward(
          explorerState.activeTabId,
          explorerState.activePaneSide,
        );
        return;
      }

      // 5. F1 -> Toggle Help Modal
      if (e.key === "F1") {
        e.preventDefault();
        console.debug("F1 Help shortcut pressed");
        explorerState.isHelpModalOpen = !explorerState.isHelpModalOpen;
        return;
      }

      // 6. Esc -> Close Modal Window
      if (e.key === "Escape") {
        if (!explorerState.isHelpModalOpen && !explorerState.isConfigModalOpen)
          return;
        e.preventDefault();
        console.debug("Esc Help/Config shortcut pressed");
        explorerState.isHelpModalOpen = false;
        explorerState.isConfigModalOpen = false;
        return;
      }

      // 7. Ctrl + o -> Toggle Settings Modal
      if (ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        console.debug("Ctrl + O shortcut pressed");
        explorerState.isConfigModalOpen = !explorerState.isConfigModalOpen;
        return;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // e.button 3: Back button, 4: Forward button
      if (e.button === 3) {
        e.preventDefault();
        console.debug("Mouse button 3 pressed");
        explorerState.goBack(
          explorerState.activeTabId,
          explorerState.activePaneSide,
        );
      } else if (e.button === 4) {
        e.preventDefault();
        console.debug("Mouse button 4 pressed");
        explorerState.goForward(
          explorerState.activeTabId,
          explorerState.activePaneSide,
        );
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Prevent default browser back/forward behavior
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("mouseup", handleMouseUp, { capture: true });
    window.addEventListener("mousedown", handleMouseDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
      window.removeEventListener("mousedown", handleMouseDown, {
        capture: true,
      });
      console.debug("Keyboard Service destroyed");
    };
  });
}
