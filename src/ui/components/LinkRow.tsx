import type { ComponentChildren } from 'preact';
import { Icon, type IconName } from './Icon';

/** A ruled-line link to another screen: icon, label, optional hint, chevron. */
export function LinkRow({ href, icon, hint, children }: { href: string; icon?: IconName; hint?: string; children: ComponentChildren }) {
  return (
    <a class="link-row" href={href}>
      {icon && <Icon name={icon} />}
      <span class="link-row-label">{children}</span>
      {hint && <span class="link-row-hint">{hint}</span>}
      <span class="link-row-chevron" aria-hidden="true">
        <Icon name="next" />
      </span>
    </a>
  );
}
