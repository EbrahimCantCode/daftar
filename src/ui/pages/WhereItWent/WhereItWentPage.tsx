import { signal } from '@preact/signals';
import { entriesInCycle } from '../../../domain/cycles';
import { inkVar } from '../../../domain/entryTypes';
import { formatFils } from '../../../domain/money';
import { OTHER_KEY, chartEntries, slicesOf, type Slice, type SliceMode } from '../../../domain/slices';
import { breakdown } from '../../../domain/totals';
import { selectCycle, viewCycle } from '../../../state/selection';
import { currentCycle, entries } from '../../../state/store';
import { Amount } from '../../components/Amount';
import { ChartContainer } from '../../components/ChartContainer';
import { CHART_INKS, OTHER_INK } from '../../components/charts/sketch';
import { Donut } from '../../components/charts/Donut';
import { CycleSelector } from '../../components/CycleSelector';
import { EmptyState } from '../../components/EmptyState';
import { HighlightBar } from '../../components/HighlightBar';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TopBar } from '../../components/TopBar';
import { QuickAddSheet } from '../Ledger/QuickAddSheet';
import { SalarySheet } from '../Ledger/SalarySheet';
import { SliceSheet, openSlice } from './SliceSheet';

const mode = signal<SliceMode>('spend');
const selected = signal<string | null>(null);

/** Slices get chart inks in order; Fixed and Saved keep their entry-type ink, Other is grey. */
function colorsFor(slices: Slice[]): string[] {
  let next = 0;
  return slices.map((s) => (s.type ? inkVar(s.type) : s.key === OTHER_KEY ? OTHER_INK : CHART_INKS[next++ % CHART_INKS.length]!));
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : 0);

export function WhereItWentPage() {
  const cycle = viewCycle.value;
  const out = chartEntries(entriesInCycle(entries.value, cycle), mode.value);
  const total = out.reduce((s, e) => s + e.amountFils, 0);
  const slices = slicesOf(out, mode.value);
  const colors = colorsFor(slices);
  const ranked = breakdown(out, Number.POSITIVE_INFINITY);
  const choose = (s: Slice) => {
    selected.value = s.key;
    openSlice(s, colors[slices.indexOf(s)]!);
  };
  const describe = (s: Slice) => `${s.label}, ${formatFils(s.totalFils)}, ${pct(s.totalFils, total)}%`;

  return (
    <div class="screen">
      <TopBar title="Where it went" />
      <CycleSelector cycle={cycle} currentKey={currentCycle.value.key} onGo={selectCycle} />
      <SegmentedControl
        label="Show"
        value={mode.value}
        onChange={(m) => {
          mode.value = m;
          selected.value = null;
        }}
        options={[
          { value: 'spend', label: 'Spending only' },
          { value: 'all', label: 'Everything out' },
        ]}
      />

      {total === 0 ? (
        <EmptyState title="Nothing spent in this cycle yet.">
          <p>Once you write things down, this shows where the money went.</p>
        </EmptyState>
      ) : (
        <>
          <ChartContainer
            title={mode.value === 'spend' ? 'Spending by description' : 'Everything out'}
            summary={`Donut chart of ${formatFils(total)}: ${slices.map(describe).join('; ')}.`}
            table={{ head: ['Slice', 'Total', 'Share'], rows: slices.map((s) => [s.label, formatFils(s.totalFils), `${pct(s.totalFils, total)}%`]) }}
          >
            {(width) => (
              <Donut
                slices={slices}
                colors={colors}
                size={Math.min(width, 280)}
                selectedKey={selected.value}
                onSelect={choose}
                describe={describe}
                center={
                  <>
                    <Amount fils={total} unit={false} />
                    <span>{mode.value === 'spend' ? 'BD spent' : 'BD out'}</span>
                  </>
                }
              />
            )}
          </ChartContainer>

          <ul class="legend" aria-label="Slices">
            {slices.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  class={`legend-row${s.key === selected.value ? ' is-selected' : ''}`}
                  style={{ '--legend-ink': colors[i] }}
                  onClick={() => choose(s)}
                >
                  <span class="legend-swatch" aria-hidden="true" />
                  <span class="legend-label">{s.label}</span>
                  <span class="legend-pct">{pct(s.totalFils, total)}%</span>
                  <Amount fils={s.totalFils} unit={false} />
                </button>
              </li>
            ))}
          </ul>

          <section class="section" aria-labelledby="ranked-title">
            <h2 class="section-title" id="ranked-title">
              Every description
            </h2>
            <div class="ranked-head" aria-hidden="true">
              <span>Description</span>
              <span>Times</span>
              <span>Total</span>
            </div>
            <ul class="bd-list">
              {ranked.map((r) => {
                const share = pct(r.totalFils, total);
                return (
                  <li class="bd-row" key={r.key}>
                    <HighlightBar class="bd-bar" width={`calc(${Math.max(share, 2)}% - 0.5rem)`} />
                    <span class="bd-label">{r.label}</span>
                    <span class="bd-count">×{r.count}</span>
                    <span class="bd-pct">{share}%</span>
                    <Amount fils={r.totalFils} unit={false} />
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
      <SliceSheet />
      <QuickAddSheet />
      <SalarySheet />
    </div>
  );
}
