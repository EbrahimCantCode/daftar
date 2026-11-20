import type { ComponentChildren } from 'preact';
import { href } from '../../state/router';
import { IconButton } from './IconButton';

export function TopBar({ title, back = false, children }: { title: ComponentChildren; back?: boolean; children?: ComponentChildren }) {
  return (
    <header class="topbar">
      {back && <IconButton icon="back" label="Back to ledger" href={href('ledger')} />}
      <h1 class="brand">{title}</h1>
      {children}
    </header>
  );
}
