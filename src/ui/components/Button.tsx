import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'danger-solid' | 'quiet';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  primary: ' primary',
  danger: ' danger',
  'danger-solid': ' danger solid',
  quiet: ' quiet',
};

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'icon' | 'class' | 'type'> & {
  variant?: ButtonVariant;
  icon?: IconName;
  type?: 'button' | 'submit';
  class?: string;
  children?: ComponentChildren;
};

/** The hand-drawn ink button. */
export function Button({ variant = 'default', icon, type = 'button', class: cls, children, ...rest }: ButtonProps) {
  return (
    <button type={type} class={`ink-btn${VARIANT_CLASS[variant]}${cls ? ` ${cls}` : ''}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/** An ink button that opens the file picker. */
export function FileButton({
  icon,
  accept,
  onFile,
  children,
}: {
  icon?: IconName;
  accept: string;
  onFile: (file: File) => void;
  children: ComponentChildren;
}) {
  return (
    <label class="ink-btn file-btn">
      {icon && <Icon name={icon} />}
      {children}
      <input
        type="file"
        accept={accept}
        class="visually-hidden"
        onChange={(e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
