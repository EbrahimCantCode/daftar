import type { ComponentChildren } from 'preact';

/** A horizontal row of chips; `wrap` lets them flow onto more lines. */
export function Chips({ label, wrap = false, children }: { label?: string; wrap?: boolean; children: ComponentChildren }) {
  return (
    <div class={`chips${wrap ? ' wrap' : ''}`} role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}

export function Chip({ onClick, children }: { onClick: () => void; children: ComponentChildren }) {
  return (
    <button type="button" class="chip" onClick={onClick}>
      {children}
    </button>
  );
}
