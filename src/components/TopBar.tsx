import type { ComponentChildren } from 'preact';
import { href } from '../state/router';
import { Icon } from './Icon';

export function TopBar({ title, back = false, children }: { title: ComponentChildren; back?: boolean; children?: ComponentChildren }) {
  return (
    <header class="topbar">
      {back && (
        <a class="icon-btn" href={href('ledger')} aria-label="Back to ledger">
          <Icon name="back" />
        </a>
      )}
      <h1 class="brand">{title}</h1>
      {children}
    </header>
  );
}
