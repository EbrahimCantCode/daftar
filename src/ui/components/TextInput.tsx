import type { Ref } from 'preact';

interface TextInputProps {
  id?: string;
  value: string;
  onInput: (value: string) => void;
  type?: 'text' | 'date';
  inputRef?: Ref<HTMLInputElement>;
  invalid?: boolean;
  /** id of the hint or error that describes this field. */
  describedBy?: string;
  ariaLabel?: string;
  placeholder?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  autoComplete?: string;
  autoCapitalize?: 'off' | 'sentences' | 'characters';
  enterKeyHint?: 'next' | 'done';
  maxLength?: number;
  pattern?: string;
  required?: boolean;
  class?: string;
  onKeyDown?: (e: KeyboardEvent) => void;
  onBlur?: () => void;
}

/** The hand-drawn text field. */
export function TextInput({ inputRef, invalid, describedBy, ariaLabel, onInput, class: cls, type = 'text', ...rest }: TextInputProps) {
  return (
    <input
      ref={inputRef}
      class={`field-input${cls ? ` ${cls}` : ''}`}
      // Preact types each input `type` as its own union member; both values here are valid.
      type={type as 'text'}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      onInput={(e) => onInput(e.currentTarget.value)}
      {...rest}
    />
  );
}

/** An amount field: typewriter digits, decimal keypad, "BD" suffix. Place inside a `.control`. */
export function AmountInput(props: Omit<TextInputProps, 'type' | 'inputMode'>) {
  return (
    <>
      <TextInput
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.000"
        {...props}
        class={`amount-input${props.class ? ` ${props.class}` : ''}`}
      />
      <span class="suffix" aria-hidden="true">
        BD
      </span>
    </>
  );
}

export function FieldError({ id, children }: { id?: string; children: string }) {
  return (
    <p class="field-error" id={id}>
      {children}
    </p>
  );
}
