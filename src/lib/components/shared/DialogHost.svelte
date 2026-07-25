<script lang="ts">
  import Modal from './Modal.svelte';
  import { dialogService } from '$lib/services/dialog.service.svelte';

  const dialog = $derived(dialogService.dialog);

  // Local buffer for prompt dialogs so typing doesn't touch global state
  let inputValue = $state('');
  let inputEl: HTMLInputElement | undefined = $state();
  let primaryBtn: HTMLButtonElement | undefined = $state();

  // Element that had focus before the dialog opened, restored on close so
  // pane keyboard shortcuts (Delete, F2, ...) keep working afterwards,
  // mirroring the native dialog behavior.
  let previousFocus: HTMLElement | null = null;

  // Capture the focused element when a dialog opens; restore it on close.
  // Declared before the focus effect below so capture happens first.
  $effect(() => {
    if (dialog) {
      if (!previousFocus && document.activeElement instanceof HTMLElement) {
        previousFocus = document.activeElement;
      }
    } else if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  });

  // Sync the input buffer and focus whenever a new dialog opens
  $effect(() => {
    if (!dialog) return;
    if (dialog.type === 'prompt') {
      inputValue = dialog.defaultValue;
      inputEl?.focus();
      inputEl?.select();
    } else {
      primaryBtn?.focus();
    }
  });

  function handleAccept() {
    if (!dialog) return;
    if (dialog.type === 'prompt') {
      if (!inputValue.trim()) return;
      dialogService.accept(inputValue);
    } else {
      dialogService.accept();
    }
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAccept();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dialogService.cancel();
    }
  }
</script>

<Modal
  title={dialog?.title ?? ''}
  size="compact"
  bind:isOpen={
    () => dialogService.isOpen,
    (v) => { if (!v) dialogService.cancel(); }
  }
>
  {#snippet icon()}
    {#if dialog?.type === 'alert'}
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    {:else if dialog?.danger}
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    {/if}
  {/snippet}

  {#if dialog}
    <div class="dialog-body">
      <p class="dialog-message">{dialog.message}</p>

      {#if dialog.type === 'prompt'}
        <input
          bind:this={inputEl}
          type="text"
          class="dialog-input"
          bind:value={inputValue}
          onkeydown={handleInputKeydown}
        />
      {/if}

      <div class="dialog-actions">
        {#if dialog.type !== 'alert'}
          <button class="dialog-btn" onclick={() => dialogService.cancel()}>
            {dialog.cancelLabel}
          </button>
        {/if}
        <button
          bind:this={primaryBtn}
          class="dialog-btn primary"
          class:danger={dialog.danger}
          disabled={dialog.type === 'prompt' && !inputValue.trim()}
          onclick={handleAccept}
        >
          {dialog.confirmLabel}
        </button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dialog-message {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--text-secondary);
    word-break: break-word;
    white-space: pre-wrap;
  }

  .dialog-input {
    width: 100%;
    height: 32px;
    font-size: 0.85rem;
    padding: 0 10px;
    background-color: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  :global(:root[data-theme="light"]) .dialog-input {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .dialog-input:focus {
    background-color: var(--bg-tertiary);
    border-color: var(--accent);
    outline: none;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .dialog-btn {
    height: 30px;
    padding: 0 16px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-secondary);
    background-color: transparent;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .dialog-btn:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .dialog-btn.primary {
    background-color: var(--accent);
    border-color: transparent;
    color: white;
    box-shadow: 0 2px 4px rgba(var(--accent-rgb), 0.2);
  }

  .dialog-btn.primary:hover:not(:disabled) {
    background-color: var(--accent-hover);
    color: white;
  }

  .dialog-btn.primary.danger {
    background-color: var(--danger);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .dialog-btn.primary.danger:hover:not(:disabled) {
    background-color: var(--danger);
    filter: brightness(1.1);
  }

  .dialog-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
