export interface Segment<T extends string> {
  value: T;
  label: string;
  /** CSS colour for the selected state, e.g. inkVar('spend'). Defaults to ink. */
  ink?: string;
}

interface SegmentedControlProps<T extends string> {
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  labelledBy?: string;
}

/** A row of mutually exclusive choices (type, theme, import mode…). */
export function SegmentedControl<T extends string>({ options, value, onChange, label, labelledBy }: SegmentedControlProps<T>) {
  return (
    <div class={`toggle${options.length > 2 ? ' many' : ''}`} role="group" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          style={o.ink ? { '--seg-ink': o.ink } : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
