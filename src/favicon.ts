import { effect } from '@preact/signals';
import { goalHeatValue, settings } from './state/store';

// The browser-tab icon follows the daily goal: blue ink when nothing is spent,
// shifting to red ink as today's spending reaches the goal.
const BLUE = [0x1c, 0x4e, 0xa1];
const RED = [0xb3, 0x26, 0x1e];

function mix(t: number): string {
  return `#${BLUE.map((b, i) => Math.round(b + (RED[i]! - b) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** public/icon.svg with the pen stroke recoloured. */
function iconSvg(stroke: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<rect width="512" height="512" rx="96" fill="#fbf6e9"/>' +
    '<path d="M40 150h432M40 222h432M40 294h432M40 366h432M40 438h432" stroke="#4278c4" stroke-opacity=".38" stroke-width="6"/>' +
    '<path d="M132 40v432" stroke="#d64541" stroke-opacity=".7" stroke-width="7"/>' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    `<path d="M184 282c34-6 70-30 96-74 14-24 8-46-12-40-26 8-44 64-38 112 4 36 26 52 60 40 30-10 56-38 86-58" stroke="${stroke}" stroke-width="22"/>` +
    '<path d="M196 352c60-8 140-10 200-6" stroke="#1b6b37" stroke-width="14" stroke-opacity=".9"/>' +
    '</g></svg>'
  );
}

export function initFavicon() {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (!link) return;
  const original = link.href;
  effect(() => {
    const heat = goalHeatValue.value;
    link.href = settings.value.dailyGoalFils ? `data:image/svg+xml,${encodeURIComponent(iconSvg(mix(heat)))}` : original;
  });
}
