import type { BreakdownRow } from '../lib/totals';
import { Amount } from './Amount';

export function Breakdown({ rows, totalFils }: { rows: BreakdownRow[]; totalFils: number }) {
  if (!rows.length || totalFils <= 0) return null;
  return (
    <section class="section" aria-labelledby="bd-title">
      <h3 class="section-title" id="bd-title">
        Where it went
      </h3>
      <ul class="bd-list">
        {rows.map((r) => {
          // Percentages are display-only; the money itself stays in integer fils.
          const pct = Math.round((r.totalFils * 100) / totalFils);
          return (
            <li class="bd-row" key={r.key}>
              <span class={`bd-bar type-${r.type}`} style={{ width: `calc(${Math.max(pct, 2)}% - 0.5rem)` }} aria-hidden="true" />
              <span class="bd-label">{r.label}</span>
              <span class="bd-pct">{pct}%</span>
              <Amount fils={r.totalFils} unit={false} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
