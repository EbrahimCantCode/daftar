import { href } from '../state/router';
import type { MonthTotals } from '../lib/totals';
import { Amount } from './Amount';

export function SummaryNote({ totals, left }: { totals: MonthTotals; left: number | undefined }) {
  return (
    <section class="sticky has-left" aria-label="Month summary">
      <dl class="sum-rows">
        <div class="sum-row ink-pencil">
          <dt>Fixed</dt>
          <dd>
            <Amount fils={totals.fixedFils} />
          </dd>
        </div>
        <div class="sum-row ink-blue">
          <dt>Spent</dt>
          <dd>
            <Amount fils={totals.spentFils} />
          </dd>
        </div>
        <div class="sum-row ink-green">
          <dt>Saved</dt>
          <dd>
            <Amount fils={totals.savedFils} />
          </dd>
        </div>
        <div class="sum-row total">
          <dt>Total out</dt>
          <dd>
            <Amount fils={totals.totalOutFils} />
          </dd>
        </div>
        <div class={`sum-row left${left !== undefined && left < 0 ? ' negative ink-red' : ''}`}>
          <dt>Left</dt>
          <dd>
            {left !== undefined ? (
              <Amount fils={left} />
            ) : (
              <a class="sticky-link" href={href('settings')}>
                Set income
              </a>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
