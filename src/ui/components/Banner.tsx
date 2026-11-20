import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

/** A small dismissible note at the top of a page. */
export function Banner({
  icon,
  label,
  onDismiss,
  children,
}: {
  icon: IconName;
  label: string;
  onDismiss: () => void;
  children: ComponentChildren;
}) {
  return (
    <aside class="banner" aria-label={label}>
      <Icon name={icon} />
      <p>{children}</p>
      <IconButton icon="close" label="Dismiss" onClick={onDismiss} />
    </aside>
  );
}
