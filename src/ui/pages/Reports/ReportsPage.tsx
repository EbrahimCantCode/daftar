import { cycleName, cycleRange, cyclesWithData } from '../../../domain/cycles';
import { href, reportHref } from '../../../state/router';
import { cycleCtx, entries, today } from '../../../state/store';
import { EmptyState } from '../../components/EmptyState';
import { LinkRow } from '../../components/LinkRow';
import { TopBar } from '../../components/TopBar';

/** Every cycle with entries, newest first, each opening its report. */
export function ReportsPage() {
  const cycles = cyclesWithData(entries.value, cycleCtx.value, today.value).reverse();
  return (
    <div class="screen">
      <TopBar title="Reports" back={href('more')} />
      <p class="page-intro">A Markdown statement you can copy, share or download, and paste into Claude.</p>
      {cycles.length === 0 ? (
        <EmptyState title="No reports yet.">
          <p>Reports appear once you’ve written something down.</p>
        </EmptyState>
      ) : (
        <section class="section" aria-labelledby="cycle-reports">
          <h2 class="section-title" id="cycle-reports">
            Cycles
          </h2>
          {cycles.map((c) => (
            <LinkRow key={c.key} href={reportHref(c.key)} hint={cycleRange(c)}>
              {cycleName(c, today.value)}
            </LinkRow>
          ))}
        </section>
      )}
    </div>
  );
}
