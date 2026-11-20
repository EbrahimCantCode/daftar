import type { ComponentChildren } from 'preact';

/** A friendly "nothing here yet" note. */
export function EmptyState({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <p class="hand">{title}</p>
      {children}
    </div>
  );
}
