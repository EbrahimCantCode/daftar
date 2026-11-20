import type { ComponentChildren } from 'preact';
import { inkVar } from '../../domain/entryTypes';
import type { EntryType } from '../../domain/types';
import { Amount } from './Amount';

interface EntryRowProps {
  type: EntryType;
  amountFils: number;
  onClick: () => void;
  /** Description text. */
  children: ComponentChildren;
  /** Extra words for screen readers only, e.g. "(spend, monthly)". */
  srText?: string;
  /** Shown before the description (e.g. the day of a monthly item). */
  leading?: ComponentChildren;
  /** Shown between the description and the amount (e.g. a repeat icon). */
  tag?: ComponentChildren;
  /** Pencil-soft ink, for paused or inactive rows. */
  muted?: boolean;
}

/** One ruled line of the ledger: description on the left, amount in the right-hand column. */
export function EntryRow({ type, amountFils, onClick, children, srText, leading, tag, muted = false }: EntryRowProps) {
  return (
    <button type="button" class="entry" style={{ '--entry-ink': muted ? 'var(--ink-soft)' : inkVar(type) }} onClick={onClick}>
      {leading}
      <span class="entry-desc">
        {children}
        {srText && <span class="visually-hidden">{srText}</span>}
      </span>
      {tag}
      <Amount fils={amountFils} unit={false} />
    </button>
  );
}
