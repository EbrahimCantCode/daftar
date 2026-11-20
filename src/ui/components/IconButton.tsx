import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  /** Accessible name; also used as the tooltip when `title` is true. */
  label: string;
  title?: boolean;
  /** Renders a link instead of a button. */
  href?: string;
  onClick?: (e: MouseEvent) => void;
}

/** A round 44px icon-only button or link. */
export function IconButton({ icon, label, title = false, href, onClick }: IconButtonProps) {
  const common = { class: 'icon-btn', 'aria-label': label, title: title ? label : undefined };
  if (href) {
    return (
      <a {...common} href={href} onClick={onClick}>
        <Icon name={icon} />
      </a>
    );
  }
  return (
    <button type="button" {...common} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}
