import type { ComponentChildren } from 'preact';

/** A taped-in sticky note. `tall` gives it an extra ruled line of height. */
export function StickyNote({ label, tall = false, children }: { label: string; tall?: boolean; children: ComponentChildren }) {
  return (
    <section class={`sticky${tall ? ' has-left' : ''}`} aria-label={label}>
      {children}
    </section>
  );
}
