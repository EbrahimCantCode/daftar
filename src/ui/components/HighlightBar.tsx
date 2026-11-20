/** A highlighter stroke behind a row, sized to a share of the whole. */
export function HighlightBar({ class: cls, width, color }: { class: string; width: string; color?: string }) {
  return <span class={cls} style={{ width, ...(color ? { background: color } : {}) }} aria-hidden="true" />;
}
