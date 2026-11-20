import type { ComponentChildren } from 'preact';
import { inkVar } from '../../../domain/entryTypes';
import type { Totals } from '../../../domain/totals';
import type { EntryType } from '../../../domain/types';
import { Amount } from '../../components/Amount';
import { StickyNote, noteLines } from '../../components/StickyNote';

/** One line on the note, inked in its entry type's colour. */
function TypeRow({ type, label, children }: { type: EntryType; label: string; children: ComponentChildren }) {
  return (
    <div class="sum-row inked" style={{ '--row-ink': inkVar(type) }}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SumRow({ class: cls, label, children }: { class: string; label: string; children: ComponentChildren }) {
  return (
    <div class={`sum-row ${cls}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

interface SummaryNoteProps {
  totals: Totals;
  left: number | undefined;
  /** Offer "Log salary" when this cycle has no income yet. */
  onLogSalary?: () => void;
}

export function SummaryNote({ totals, left, onLogSalary }: SummaryNoteProps) {
  const noIncome = totals.incomeFils === 0;
  return (
    <StickyNote label="Cycle summary" lines={noteLines(5)}>
      <dl class="sum-rows">
        <TypeRow type="income" label="Income">
          {noIncome && onLogSalary ? (
            <button type="button" class="sticky-link" onClick={onLogSalary}>
              Log salary
            </button>
          ) : noIncome ? (
            '–'
          ) : (
            <Amount fils={totals.incomeFils} />
          )}
        </TypeRow>
        <TypeRow type="fixed" label="Fixed">
          <Amount fils={totals.fixedFils} />
        </TypeRow>
        <TypeRow type="spend" label="Spent">
          <Amount fils={totals.spentFils} />
        </TypeRow>
        <TypeRow type="savings" label="Saved">
          <Amount fils={totals.savedFils} />
        </TypeRow>
        <SumRow class="total" label="Total out">
          <Amount fils={totals.totalOutFils} />
        </SumRow>
        <SumRow class={`left${left !== undefined && left < 0 ? ' negative ink-red' : ''}`} label="Left">
          {left !== undefined ? <Amount fils={left} /> : '–'}
        </SumRow>
      </dl>
    </StickyNote>
  );
}
