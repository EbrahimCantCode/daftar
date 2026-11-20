import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Breakdown } from './Breakdown';
import { DayList } from './DayList';
import { MonthNav } from './MonthNav';
import { ReportBanner } from './ReportBanner';
import { QuickAddSheet, onEntrySaved, openQuickAdd } from './QuickAddSheet';
import { SummaryNote } from './SummaryNote';
import { TodayGoal } from './TodayGoal';
import { EmptyState } from '../../components/EmptyState';
import { Fab } from '../../components/Fab';
import { IconButton } from '../../components/IconButton';
import { TopBar } from '../../components/TopBar';
import { addMonths, monthOf } from '../../../domain/dates';
import { breakdown, entriesInMonth, groupByDay, leftThisMonth, monthTotals } from '../../../domain/totals';
import { href, reportHref } from '../../../state/router';
import { entries, goalHeatValue, settings, today } from '../../../state/store';

const viewMonth = signal(monthOf(today.value));
const turn = signal<'next' | 'prev' | null>(null);

function goMonth(month: string) {
  if (month === viewMonth.value) return;
  turn.value = month > viewMonth.value ? 'next' : 'prev';
  viewMonth.value = month;
}

onEntrySaved(goMonth);

/** Opens quick add when launched from the "Add expense" app shortcut (?add=1). */
function handleLaunchParams() {
  const params = new URLSearchParams(location.search);
  if (params.get('add') !== '1') return;
  params.delete('add');
  const query = params.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  openQuickAdd();
}

export function LedgerPage() {
  const month = viewMonth.value;
  const thisMonth = monthOf(today.value);
  const monthEntries = entriesInMonth(entries.value, month);
  const totals = monthTotals(monthEntries);
  const left = leftThisMonth(settings.value.monthlyIncomeFils, totals);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    handleLaunchParams();
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest('input, textarea, select, dialog, [contenteditable]')) return;
      if (e.key === 'n' || e.key === '+') {
        e.preventDefault();
        openQuickAdd();
      } else if (e.key === 'ArrowLeft') goMonth(addMonths(viewMonth.value, -1));
      else if (e.key === 'ArrowRight') goMonth(addMonths(viewMonth.value, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="screen">
      <TopBar title="Daftar">
        <IconButton icon="report" label="Month report" title href={reportHref(month)} />
        <IconButton icon="repeat" label="Monthly items" title href={href('monthly')} />
        <IconButton icon="gear" label="Settings" title href={href('settings')} />
      </TopBar>

      <ReportBanner />
      <MonthNav month={month} current={thisMonth} onGo={goMonth} />

      <div class="month-viewport">
        <div
          key={month}
          class={`month-page${turn.value ? ` turn-${turn.value}` : ''}`}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            const t = e.changedTouches[0];
            touch.current = null;
            if (!start || !t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) goMonth(addMonths(month, dx < 0 ? 1 : -1));
          }}
        >
          {month === thisMonth && <TodayGoal />}
          <SummaryNote totals={totals} left={left} />

          {monthEntries.length === 0 ? (
            <EmptyState title="Nothing written here yet.">
              <p>{month === thisMonth ? 'Tap the pen to write down what you spend.' : 'No entries this month.'}</p>
            </EmptyState>
          ) : (
            <>
              <DayList groups={groupByDay(monthEntries)} onEdit={openQuickAdd} />
              <Breakdown rows={breakdown(monthEntries)} totalFils={totals.totalOutFils} />
            </>
          )}
        </div>
      </div>

      <Fab icon="pen" label="Add expense" title="Add expense (N)" heat={goalHeatValue.value} onClick={() => openQuickAdd()} />
      <QuickAddSheet />
    </div>
  );
}
