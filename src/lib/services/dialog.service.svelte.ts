export type DialogType = "alert" | "confirm" | "prompt";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; //Renders the confirm button with the danger color (destructive actions)
}

export interface DialogState {
  type: DialogType;
  title: string;
  message: string;
  defaultValue: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
}

type DialogResult = string | boolean | null | void;

/**
 * Global promise-based replacement for the native browser dialogs
 * (alert / confirm / prompt). The DialogHost component renders the
 * pending dialog; callers simply await the returned promise.
 */
export class DialogService {
  dialog: DialogState | null = $state(null);
  private resolver: ((value: DialogResult) => void) | null = null;

  get isOpen() {
    return this.dialog !== null;
  }

  private open<T extends DialogResult>(state: DialogState): Promise<T> {
    // Only one dialog at a time: cancel any pending one first
    if (this.dialog) this.cancel();
    return new Promise<T>((resolve) => {
      this.resolver = resolve as (value: DialogResult) => void;
      this.dialog = state;
    });
  }

  /** Native `alert()` equivalent. Resolves when the user closes the dialog. */
  alert(message: string, title = "Error"): Promise<void> {
    return this.open<void>({
      type: "alert",
      title,
      message,
      defaultValue: "",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      danger: false,
    });
  }

  /** Native `confirm()` equivalent. Resolves `true` on accept, `false` on cancel. */
  confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return this.open<boolean>({
      type: "confirm",
      title: options.title ?? "Confirm",
      message,
      defaultValue: "",
      confirmLabel: options.confirmLabel ?? "Confirm",
      cancelLabel: options.cancelLabel ?? "Cancel",
      danger: options.danger ?? false,
    });
  }

  /** Native `prompt()` equivalent. Resolves the input text on accept, `null` on cancel. */
  prompt(
    message: string,
    defaultValue = "",
    title = "Input",
  ): Promise<string | null> {
    return this.open<string | null>({
      type: "prompt",
      title,
      message,
      defaultValue,
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      danger: false,
    });
  }

  /** Accept the current dialog (called by DialogHost). */
  accept(promptValue?: string) {
    if (!this.dialog) return;
    const type = this.dialog.type;
    const resolver = this.resolver;
    this.resolver = null;
    this.dialog = null;
    if (type === "prompt") resolver?.(promptValue ?? "");
    else if (type === "confirm") resolver?.(true);
    else resolver?.();
  }

  /** Cancel the current dialog: overlay click, X button or Escape. */
  cancel() {
    if (!this.dialog) return;
    const type = this.dialog.type;
    const resolver = this.resolver;
    this.resolver = null;
    this.dialog = null;
    if (type === "prompt") resolver?.(null);
    else if (type === "confirm") resolver?.(false);
    else resolver?.();
  }
}

export const dialogService = new DialogService();
