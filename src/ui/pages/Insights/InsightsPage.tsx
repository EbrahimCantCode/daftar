import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { addMonths, dayLabel, monthLabel } from '../../../domain/dates';
import { cycleByKey, cycleName, cycleRange, entriesInCycle } from '../../../domain/cycles';
import { inkVar } from '../../../domain/entryTypes';
import {
  balanceSeries,
  cyclePoints,
  dailySpend,
  dailyStats,
  descriptionTrend,
  fixedShareOf,
  rangeCycles,
  rateOf,
  records,
  spendingPace,
  topDescriptions,
  type InsightRange,
} from '../../../domain/insights';
import { formatFils } from '../../../domain/money';
import { selectCycle, viewCycle } from '../../../state/selection';
import { currentCycle, cycleCtx, entries, settings, today } from '../../../state/store';
import { Amount } from '../../components/Amount';
import { ChartContainer } from '../../components/ChartContainer';
import { Bars } from '../../components/charts/Bars';
import { Heatmap } from '../../components/charts/Heatmap';
import { Lines, type LineSeries } from '../../components/charts/Lines';
import { Chip, Chips } from '../../components/Chips';
import { EmptyState } from '../../components/EmptyState';
import { IconButton } from '../../components/IconButton';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatCard, StatGrid } from '../../components/StatCard';
import { TopBar } from '../../components/TopBar';

const range = signal<InsightRange>('last6');
const trendKey = signal<string | null>(null);

const NEED_TWO = 'Compare cycles once you have two of them. Keep writing things down.';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Whole dinars for axes: "850", "1,250". */
const dinars = (fils: number) => Math.round(fils / 1000).toLocaleString('en');
const pctText = (v: number | null) => (v === null ? '–' : `${v < 0 ? '−' : ''}${Math.abs(v)}%`);
const shortName = (key: string) => monthLabel(key, { short: true });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Key({ items }: { items: { name: string; color: string; style?: 'solid' | 'dash' | 'dot' }[] }) {
  return (
    <p class="chart-key" aria-hidden="true">
      {items.map((it) => (
        <span key={it.name} style={{ '--key-ink': it.color }}>
          <i class={it.style ?? 'solid'} />
          {it.name}
        </span>
      ))}
    </p>
  );
}

/** A chart whose tapped column shows its values in the caption. */
function Tappable({ children }: { children: (selected: number | null, select: (i: number) => void) => ComponentChildren }) {
  const [selected, setSelected] = useState<number | null>(null);
  return <>{children(selected, (i) => setSelected(selected === i ? null : i))}</>;
}

export function InsightsPage() {
  const all = entries.value;
  const ctx = cycleCtx.value;
  const now = today.value;
  const cycles = rangeCycles(all, ctx, now, range.value);
  const points = cyclePoints(all, cycles, now);
  const labels = cycles.map((c) => shortName(c.key));
  const enough = points.length >= 2;
  const hasIncome = points.some((p) => p.totals.incomeFils > 0);
  const current = currentCycle.value;
  const starting = settings.value.startingSavingsFils;

  if (!all.length) {
    return (
      <div class="screen">
        <TopBar title="Insights" />
        <EmptyState title="Nothing to look at yet.">
          <p>Insights appear once you’ve written down a few things.</p>
        </EmptyState>
      </div>
    );
  }

  // Pace: this cycle against the cycles before it in range.
  const earlier = cycles.filter((c) => c.key < current.key);
  const pace = spendingPace(all, current, earlier, now);
  const paceLabels = Array.from({ length: pace.cycleDays }, (_, i) => (i === 0 || (i + 1) % 7 === 0 ? String(i + 1) : ''));
  const pad = (v: number[] | null) => (v ? Array.from({ length: pace.cycleDays }, (_, i) => v[Math.min(i, v.length - 1)] ?? null) : null);
  const paceSeries: LineSeries[] = [
    { name: 'This cycle', color: inkVar('spend'), values: Array.from({ length: pace.cycleDays }, (_, i) => pace.current[i] ?? null) },
  ];
  if (pace.previous) paceSeries.push({ name: 'Last cycle', color: 'var(--chart-3)', values: pad(pace.previous)!, style: 'dash' });
  if (pace.average) paceSeries.push({ name: 'Average', color: 'var(--chart-other)', values: pad(pace.average)!, style: 'dot' });

  const daily = dailyStats(all, cycles, now);
  const rec = records(all, ctx, now);
  const options = topDescriptions(all, cycles);
  const chosen = options.find((o) => o.key === trendKey.value) ?? options[0];
  const trend = chosen ? descriptionTrend(all, cycles, chosen.key) : [];
  const heatCycle = viewCycle.value;
  const heatDays = dailySpend(all, heatCycle);

  return (
    <div class="screen">
      <TopBar title="Insights" />
      <SegmentedControl
        label="Cycles to compare"
        value={range.value}
        onChange={(r) => (range.value = r)}
        options={[
          { value: 'last6', label: 'Last 6' },
          { value: 'last12', label: 'Last 12' },
          { value: 'year', label: 'This year' },
          { value: 'all', label: 'All' },
        ]}
      />

      {/* 1. Income vs total out */}
      <Tappable>
        {(sel, select) => (
          <ChartContainer
            title="Income vs total out"
            summary={`Bars comparing income and total out for ${plural(points.length, 'cycle', 'cycles')}, with net saved marked.`}
            empty={enough ? null : NEED_TWO}
            table={{
              head: ['Cycle', 'Income', 'Total out', 'Net saved'],
              rows: points.map((p) => [cycleName(p.cycle), formatFils(p.totals.incomeFils), formatFils(p.totals.totalOutFils), formatFils(p.totals.netSavedFils)]),
            }}
            note={
              sel !== null ? (
                <>
                  {cycleName(points[sel]!.cycle)}: in {formatFils(points[sel]!.totals.incomeFils)}, out {formatFils(points[sel]!.totals.totalOutFils)}, net saved{' '}
                  {formatFils(points[sel]!.totals.netSavedFils)}
                </>
              ) : (
                'Tap a cycle to see its numbers.'
              )
            }
          >
            {(width) => (
              <>
                <Bars
                  labels={labels}
                  width={width}
                  axis={dinars}
                  series={[
                    { name: 'Income', color: inkVar('income'), values: points.map((p) => p.totals.incomeFils) },
                    { name: 'Total out', color: inkVar('spend'), values: points.map((p) => p.totals.totalOutFils) },
                  ]}
                  marks={{ name: 'Net saved', color: inkVar('savings'), values: points.map((p) => p.totals.netSavedFils) }}
                  selected={sel}
                  onSelect={select}
                  describe={(i) => `${cycleName(points[i]!.cycle)}, income ${formatFils(points[i]!.totals.incomeFils)}, out ${formatFils(points[i]!.totals.totalOutFils)}`}
                />
                <Key
                  items={[
                    { name: 'Income', color: inkVar('income') },
                    { name: 'Total out', color: inkVar('spend') },
                    { name: 'Net saved (stroke)', color: inkVar('savings') },
                  ]}
                />
              </>
            )}
          </ChartContainer>
        )}
      </Tappable>

      {/* 2. Savings balance */}
      <Tappable>
        {(sel, select) => {
          const balance = balanceSeries(all, cycles, starting, now);
          return (
            <ChartContainer
              title={starting === undefined ? 'Savings, change since you started' : 'Savings balance'}
              summary="Line of the savings balance at the end of each cycle."
              empty={enough ? null : NEED_TWO}
              table={{ head: ['Cycle', 'Balance'], rows: points.map((p, i) => [cycleName(p.cycle), formatFils(balance[i]!)]) }}
              note={
                sel !== null
                  ? `${cycleName(points[sel]!.cycle)}: ${formatFils(balance[sel]!)}`
                  : starting === undefined
                    ? 'Set a starting balance in Settings to see the real balance.'
                    : 'Tap a cycle to see its balance.'
              }
            >
              {(width) => (
                <Lines
                  labels={labels}
                  width={width}
                  axis={dinars}
                  dots
                  series={[{ name: 'Savings', color: inkVar('savings'), values: balance }]}
                  selected={sel}
                  onSelect={select}
                  describe={(i) => `${cycleName(points[i]!.cycle)}, ${formatFils(balance[i]!)}`}
                />
              )}
            </ChartContainer>
          );
        }}
      </Tappable>

      {/* 3. Savings rate */}
      <Tappable>
        {(sel, select) => {
          const rates = points.map((p) => rateOf(p.totals));
          return (
            <ChartContainer
              title="Savings rate"
              summary="Bars of net saved as a share of income, per cycle."
              empty={!enough ? NEED_TWO : hasIncome ? null : 'Log your salary to see what share of it you keep.'}
              table={{ head: ['Cycle', 'Savings rate'], rows: points.map((p, i) => [cycleName(p.cycle), pctText(rates[i]!)]) }}
              note={sel !== null ? `${cycleName(points[sel]!.cycle)}: ${pctText(rates[sel]!)} of income kept` : 'Net saved ÷ income.'}
            >
              {(width) => (
                <Bars
                  labels={labels}
                  width={width}
                  axis={(v) => `${v}%`}
                  series={[{ name: 'Savings rate', color: inkVar('savings'), values: rates }]}
                  selected={sel}
                  onSelect={select}
                  describe={(i) => `${cycleName(points[i]!.cycle)}, ${pctText(rates[i]!)}`}
                />
              )}
            </ChartContainer>
          );
        }}
      </Tappable>

      {/* 4. Spending pace */}
      <Tappable>
        {(sel, select) => (
          <ChartContainer
            title={`Spending pace, ${cycleName(current, now)}`}
            summary="Cumulative spending by day of this cycle, with last cycle and the average cycle."
            table={{
              head: ['Day', ...paceSeries.map((s) => s.name)],
              rows: paceSeries[0]!.values.map((_, i) => [String(i + 1), ...paceSeries.map((s) => (s.values[i] === null ? '–' : formatFils(s.values[i]!)))]),
            }}
            note={
              sel !== null ? (
                <>
                  Day {sel + 1}: {paceSeries.map((s) => `${s.name.toLowerCase()} ${s.values[sel] === null ? '–' : formatFils(s.values[sel]!)}`).join(', ')}
                </>
              ) : (
                <>
                  At this pace you’ll spend <strong>{formatFils(pace.projectedFils)}</strong> by payday.
                </>
              )
            }
          >
            {(width) => (
              <>
                <Lines labels={paceLabels} width={width} axis={dinars} series={paceSeries} selected={sel} onSelect={select} describe={(i) => `Day ${i + 1}`} />
                <Key items={paceSeries.map((s) => ({ name: s.name, color: s.color, style: s.style }))} />
              </>
            )}
          </ChartContainer>
        )}
      </Tappable>

      {/* 5. Daily spending and weekdays */}
      <Tappable>
        {(sel, select) => (
          <ChartContainer
            title="Which days cost the most"
            summary="Bars of average spending on each day of the week."
            empty={daily.days ? null : 'No days to average yet.'}
            table={{ head: ['Day', 'Average spent'], rows: WEEKDAYS.map((d, i) => [d, formatFils(daily.byWeekday[i]!)]) }}
            note={
              sel !== null ? (
                `${WEEKDAYS[sel]}: ${formatFils(daily.byWeekday[sel]!)} on average`
              ) : (
                <>
                  On average you spend <strong>{formatFils(daily.averageFils)}</strong> a day ({plural(daily.days, 'day', 'days')}).
                </>
              )
            }
          >
            {(width) => (
              <Bars
                labels={WEEKDAYS}
                width={width}
                axis={dinars}
                series={[{ name: 'Average spent', color: inkVar('spend'), values: daily.byWeekday }]}
                selected={sel}
                onSelect={select}
                describe={(i) => `${WEEKDAYS[i]}, ${formatFils(daily.byWeekday[i]!)}`}
              />
            )}
          </ChartContainer>
        )}
      </Tappable>

      {/* 6. Fixed costs as a share of income */}
      <Tappable>
        {(sel, select) => {
          const shares = points.map((p) => fixedShareOf(p.totals));
          return (
            <ChartContainer
              title="Fixed costs, % of income"
              summary="Line of fixed costs as a share of income, per cycle."
              empty={!enough ? NEED_TWO : hasIncome ? null : 'Log your salary to see fixed costs against it.'}
              table={{ head: ['Cycle', 'Fixed share'], rows: points.map((p, i) => [cycleName(p.cycle), pctText(shares[i]!)]) }}
              note={sel !== null ? `${cycleName(points[sel]!.cycle)}: ${pctText(shares[sel]!)} of income went to fixed costs` : 'Tap a cycle to see its share.'}
            >
              {(width) => (
                <Lines
                  labels={labels}
                  width={width}
                  axis={(v) => `${v}%`}
                  dots
                  series={[{ name: 'Fixed', color: inkVar('fixed'), values: shares }]}
                  selected={sel}
                  onSelect={select}
                  describe={(i) => `${cycleName(points[i]!.cycle)}, ${pctText(shares[i]!)}`}
                />
              )}
            </ChartContainer>
          );
        }}
      </Tappable>

      {/* 7. A description over time */}
      {chosen && (
        <Tappable>
          {(sel, select) => (
            <ChartContainer
              title={`${chosen.label}, per cycle`}
              summary={`Bars of spending on ${chosen.label} in each cycle.`}
              empty={enough ? null : NEED_TWO}
              table={{ head: ['Cycle', chosen.label], rows: points.map((p, i) => [cycleName(p.cycle), formatFils(trend[i]!)]) }}
              note={sel !== null ? `${cycleName(points[sel]!.cycle)}: ${formatFils(trend[sel]!)}` : 'Pick a description to follow:'}
            >
              {(width) => (
                <Bars
                  labels={labels}
                  width={width}
                  axis={dinars}
                  series={[{ name: chosen.label, color: 'var(--chart-2)', values: trend }]}
                  selected={sel}
                  onSelect={select}
                  describe={(i) => `${cycleName(points[i]!.cycle)}, ${formatFils(trend[i]!)}`}
                />
              )}
            </ChartContainer>
          )}
        </Tappable>
      )}
      {options.length > 1 && (
        <Chips label="Descriptions">
          {options.map((o) => (
            <Chip key={o.key} onClick={() => (trendKey.value = o.key)}>
              {o.key === chosen?.key ? `✓ ${o.label}` : o.label}
            </Chip>
          ))}
        </Chips>
      )}

      {/* 8. Streaks & records */}
      <section class="section" aria-labelledby="records-title">
        <h2 class="section-title" id="records-title">
          Streaks & records
        </h2>
        <StatGrid label="Streaks and records">
          <StatCard label="Cycles saving" value={plural(rec.positiveNetSaved.current, 'cycle', 'cycles')} sub={`best ${rec.positiveNetSaved.best}, net saved above zero`} />
          <StatCard label="No withdrawals" value={plural(rec.noWithdrawals.current, 'cycle', 'cycles')} sub={`best ${rec.noWithdrawals.best}`} />
          <StatCard label="No-spend days" value={plural(rec.noSpendDays.current, 'day', 'days')} sub={`best ${rec.noSpendDays.best} in a row`} />
          <StatCard label="Under income" value={plural(rec.underIncome.current, 'cycle', 'cycles')} sub={`best ${rec.underIncome.best}, total out within income`} />
          {rec.biggestExpense && (
            <StatCard
              label="Biggest expense"
              value={<Amount fils={rec.biggestExpense.amountFils} />}
              sub={`${rec.biggestExpense.description}, ${dayLabel(rec.biggestExpense.date)}`}
            />
          )}
          {rec.bestCycle && (
            <StatCard label="Best cycle" value={cycleName(rec.bestCycle.cycle, now)} sub={`net saved ${formatFils(rec.bestCycle.totals.netSavedFils)}`} />
          )}
          {rec.lowestSpendingCycle && (
            <StatCard
              label="Lowest spending"
              value={cycleName(rec.lowestSpendingCycle.cycle, now)}
              sub={`${formatFils(rec.lowestSpendingCycle.totals.spentFils)} spent`}
            />
          )}
        </StatGrid>
        {!rec.bestCycle && <p class="hint">Cycle records appear once a cycle has finished.</p>}
      </section>

      {/* 9. Calendar heatmap */}
      <HeatmapSection cycleKey={heatCycle.key} days={heatDays} />
    </div>
  );
}

function HeatmapSection({ cycleKey, days }: { cycleKey: string; days: { date: string; fils: number }[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const cycle = cycleByKey(cycleKey, cycleCtx.value);
  const picked = days.find((d) => d.date === sel);
  const total = days.reduce((s, d) => s + d.fils, 0);
  return (
    <ChartContainer
      title={`Daily spending, ${cycleName(cycle, today.value)}`}
      summary={`Calendar of daily spending for ${cycleRange(cycle)}; darker squares mean more spent.`}
      empty={entriesInCycle(entries.value, cycle).length ? null : 'No entries in this cycle.'}
      table={{ head: ['Day', 'Spent'], rows: days.map((d) => [dayLabel(d.date), formatFils(d.fils)]) }}
      note={
        <span class="heat-nav">
          <IconButton icon="prev" label="Previous cycle" onClick={() => selectCycle(addMonths(cycleKey, -1))} />
          <span>{picked ? `${dayLabel(picked.date)}: ${formatFils(picked.fils)}` : `${cycleRange(cycle)} · ${formatFils(total)} spent`}</span>
          <IconButton icon="next" label="Next cycle" onClick={() => selectCycle(addMonths(cycleKey, 1))} />
        </span>
      }
    >
      {(width) => (
        <Heatmap
          days={days}
          width={width}
          today={today.value}
          selected={sel}
          onSelect={(d) => setSel(sel === d ? null : d)}
          describe={(d) => `${dayLabel(d.date)}, ${formatFils(d.fils)}`}
        />
      )}
    </ChartContainer>
  );
}
