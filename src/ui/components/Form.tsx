import type { ComponentChildren } from 'preact';

/** A form line on an index card: label in the margin, control beside it. */
export function FormRow({
  label,
  htmlFor,
  controlClass,
  children,
}: {
  label: string;
  /** When set the label is a <label for>; otherwise a plain caption (for groups). */
  htmlFor?: string;
  controlClass?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="form-row">
      {htmlFor ? <label for={htmlFor}>{label}</label> : <span class="label">{label}</span>}
      <div class={`control${controlClass ? ` ${controlClass}` : ''}`}>{children}</div>
    </div>
  );
}

/** The bottom row of a sheet: an optional left action and the primary action on the right. */
export function FormActions({ left, children }: { left?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="card-actions">
      {left ?? <span class="spacer" />}
      {children}
    </div>
  );
}

export function Hint({ id, children }: { id?: string; children: ComponentChildren }) {
  return (
    <p class="hint" id={id}>
      {children}
    </p>
  );
}
