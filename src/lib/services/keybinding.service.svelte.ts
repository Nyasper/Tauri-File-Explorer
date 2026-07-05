import { explorerState } from "../state/explorer.svelte";

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
