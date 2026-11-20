import type { ComponentChildren } from 'preact';
import { ENTRY_TYPES, inkVar } from '../../../domain/entryTypes';
import type { MonthTotals } from '../../../domain/totals';
import type { EntryType } from '../../../domain/types';
import { href } from '../../../state/router';
import { Amount } from '../../components/Amount';
import { StickyNote } from '../../components/StickyNote';

/** One line on the note, inked in its entry type's colour. */
function TypeRow({ type, label, fils }: { type: EntryType; label?: string; fils: number }) {
  return (
    <div class="sum-row inked" style={{ '--row-ink': inkVar(type) }}>
      <dt>{label ?? ENTRY_TYPES[type].label}</dt>
      <dd>
        <Amount fils={fils} />
      </dd>
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

export function SummaryNote({ totals, left }: { totals: MonthTotals; left: number | undefined }) {
  return (
    <StickyNote label="Month summary" tall>
      <dl class="sum-rows">
        <TypeRow type="fixed" fils={totals.fixedFils} />
        <TypeRow type="spend" label="Spent" fils={totals.spentFils} />
        <TypeRow type="savings" label="Saved" fils={totals.savedFils} />
        <SumRow class="total" label="Total out">
          <Amount fils={totals.totalOutFils} />
        </SumRow>
        <SumRow class={`left${left !== undefined && left < 0 ? ' negative ink-red' : ''}`} label="Left">
          {left !== undefined ? (
            <Amount fils={left} />
          ) : (
            <a class="sticky-link" href={href('settings')}>
              Set income
            </a>
          )}
        </SumRow>
      </dl>
    </StickyNote>
  );
}
