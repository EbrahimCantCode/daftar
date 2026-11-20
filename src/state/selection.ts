import { computed, signal } from '@preact/signals';
import { cycleByKey } from '../domain/cycles';
import { currentCycle, cycleCtx } from './store';

/** The cycle every tab is looking at. null means "follow the current cycle". */
const selectedKey = signal<string | null>(null);
/** Direction of the last change, for the page-turn animation. */
export const turn = signal<'next' | 'prev' | null>(null);

export const viewCycle = computed(() => cycleByKey(selectedKey.value ?? currentCycle.value.key, cycleCtx.value));
export const viewingCurrent = computed(() => viewCycle.value.key === currentCycle.value.key);

export function selectCycle(key: string): void {
  const from = viewCycle.value.key;
  if (key === from) return;
  turn.value = key > from ? 'next' : 'prev';
  selectedKey.value = key === currentCycle.value.key ? null : key;
}
