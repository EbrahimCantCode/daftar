import type { ComponentChildren } from 'preact';
import { goBack } from '../../state/router';
import { IconButton } from './IconButton';

/**
 * The page heading. `back` adds a back arrow: it returns to the previous screen,
 * or to `back` (a hash) when the app was opened straight onto this one.
 */
export function TopBar({ title, back, children }: { title: ComponentChildren; back?: string; children?: ComponentChildren }) {
  return (
    <header class="topbar">
      {back !== undefined && <IconButton icon="back" label="Back" onClick={() => goBack(back)} />}
      <h1 class="brand">{title}</h1>
      {children}
    </header>
  );
}
