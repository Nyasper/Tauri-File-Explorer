<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  interface DirEntry {
    name: string;
    is_dir: boolean;
    is_file: boolean;
    size: number;
    readonly: boolean;
  }

  let path = $state("");
  let entries = $state<DirEntry[]>([]);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function oninput() {
    clearTimeout(timeout);
    loading = true;
    timeout = setTimeout(() => {
      loading = false;
      listDir();
    }, 600);
  }

  async function listDir() {
    error = null;
    entries = [];
    if (!path.trim()) return;
    try {
      entries = await invoke<DirEntry[]>("list_dir", { path });
    } catch (e) {
      error = String(e);
    }
  }
</script>

<main class="container">
  <h1>File Explorer</h1>

  <div class="search">
    <input
      id="path-input"
      placeholder="Enter a path... (e.g. C:\\Users or /home)"
      bind:value={path}
      {oninput}
    />
  </div>

  {#if loading}
    <p class="status">Listing directory...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if entries.length === 0}
    <p class="status">No directory listed yet.</p>
  {:else}
    <ul class="entries">
      {#each entries as entry (entry.name)}
        <li class="entry">
          <span class="icon">{entry.is_dir ? "📁" : "📄"}</span>
          <span class="name">{entry.name}</span>
          {#if entry.is_file && entry.size > 0}
            <span class="size">{formatSize(entry.size)}</span>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="count">{entries.length} items</p>
  {/if}
</main>

<style>
  :root {
    font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    color: #0f0f0f;
    background-color: #f6f6f6;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }

  .container {
    margin: 0 auto;
    padding: 2rem;
    max-width: 720px;
    text-align: center;
  }

  h1 {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .search {
    margin-bottom: 1.5rem;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 0.6em 1.2em;
    font-size: 1em;
    font-weight: 500;
    font-family: inherit;
    color: #0f0f0f;
    background-color: #ffffff;
    transition: border-color 0.25s;
    box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
    outline: none;
  }

  input:focus {
    border-color: #396cd8;
  }

  .status {
    color: #888;
    font-style: italic;
  }

  .error {
    color: #d22;
    font-weight: 500;
  }

  .entries {
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: left;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }

  .entry {
    display: grid;
    grid-template-columns: 2em 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #eee;
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry:hover {
    background-color: #f0f4ff;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    color: #888;
    font-size: 0.85em;
    white-space: nowrap;
  }

  .count {
    margin-top: 1rem;
    color: #666;
    font-size: 0.9em;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color: #f6f6f6;
      background-color: #2f2f2f;
    }

    input {
      color: #ffffff;
      background-color: #0f0f0f98;
    }

    .entries {
      border-color: #444;
    }

    .entry {
      border-bottom-color: #333;
    }

    .entry:hover {
      background-color: #1a2a4a;
    }

    .status,
    .size {
      color: #aaa;
    }

    .count {
      color: #aaa;
    }
  }
</style>