import { effect } from '@preact/signals';
import { settings } from './state/store';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const theme = settings.value.theme;
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  // Match the browser/status bar to the paper colour.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = paper || '#fbf6e9';
  document.head.append(meta);
}

export function initTheme() {
  effect(applyTheme);
  media.addEventListener('change', applyTheme);
}
