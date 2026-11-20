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
  /** Savings balance at the end of the cycle (or today), when it can be worked out. */
  savingsBalance?: number;
  /** Offer "Log salary" when this cycle has no income yet. */
  onLogSalary?: () => void;
}

export function SummaryNote({ totals, left, savingsBalance, onLogSalary }: SummaryNoteProps) {
  const noIncome = totals.incomeFils === 0;
  const withdrew = totals.withdrawnFils > 0;
  const rows = 5 + (withdrew ? 1 : 0) + (savingsBalance !== undefined ? 1 : 0);
  return (
    <StickyNote label="Cycle summary" lines={noteLines(rows)}>
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
        {withdrew && (
          <TypeRow type="withdrawal" label="From savings">
            <Amount fils={totals.withdrawnFils} />
          </TypeRow>
        )}
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
        {savingsBalance !== undefined && (
          <SumRow class={`balance${savingsBalance < 0 ? ' ink-red' : ''}`} label="In savings">
            <Amount fils={savingsBalance} />
          </SumRow>
        )}
      </dl>
    </StickyNote>
  );
}
