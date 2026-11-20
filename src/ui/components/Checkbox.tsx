import type { ComponentChildren } from 'preact';

export function Checkbox({
  checked,
  onChange,
  class: cls,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <label class={`check${cls ? ` ${cls}` : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      {children}
    </label>
  );
}
