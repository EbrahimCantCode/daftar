import { signal } from '@preact/signals';

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  action?: () => void | Promise<void>;
}

const toast = signal<ToastState | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export function showToast(message: string, opts: { actionLabel?: string; action?: () => void | Promise<void>; ms?: number } = {}) {
  clearTimeout(timer);
  const id = ++seq;
  toast.value = { id, message, actionLabel: opts.actionLabel, action: opts.action };
  timer = setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, opts.ms ?? (opts.action ? 6000 : 3000));
}

export function Toast() {
  const t = toast.value;
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {t && (
        <div class="toast" key={t.id}>
          <span class="toast-msg">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={async () => {
                toast.value = null;
                await t.action!();
              }}
            >
              {t.actionLabel ?? 'Undo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
