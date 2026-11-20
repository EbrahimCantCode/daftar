import { useEffect, useRef } from 'preact/hooks';
import { addMonths } from '../../../domain/dates';
import { cycleFor, entriesInCycle } from '../../../domain/cycles';
import type { Entry } from '../../../domain/types';
import { groupByDay, leftOf, savingsBalance, totalsOf } from '../../../domain/totals';
import { reportHref } from '../../../state/router';
import { selectCycle, turn, viewCycle, viewingCurrent } from '../../../state/selection';
import { currentCycle, cycleCtx, entries, goalHeatValue, settings, today } from '../../../state/store';
import { CycleSelector } from '../../components/CycleSelector';
import { EmptyState } from '../../components/EmptyState';
import { Fab } from '../../components/Fab';
import { IconButton } from '../../components/IconButton';
import { TopBar } from '../../components/TopBar';
import { DayList } from './DayList';
import { LedgerBanners } from './LedgerBanners';
import { QuickAddSheet, onEntrySaved, openQuickAdd } from './QuickAddSheet';
import { SalarySheet, onIncomeSaved, openSalary } from './SalarySheet';
import { SummaryNote } from './SummaryNote';
import { TodayGoal } from './TodayGoal';

/** After saving, turn to the cycle the entry landed in. */
const showCycleOf = (date: string) => selectCycle(cycleFor(date, cycleCtx.value).key);
onEntrySaved(showCycleOf);
onIncomeSaved(showCycleOf);

const editEntry = (e: Entry) => (e.type === 'income' ? openSalary(e) : openQuickAdd(e));

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
  const cycle = viewCycle.value;
  const isCurrent = viewingCurrent.value;
  const cycleEntries = entriesInCycle(entries.value, cycle);
  const totals = totalsOf(cycleEntries);
  const starting = settings.value.startingSavingsFils;
  const balanceDate = today.value < cycle.end ? today.value : cycle.end;
  const balance = starting === undefined ? undefined : savingsBalance(entries.value, starting, balanceDate);
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
      } else if (e.key === 'ArrowLeft') selectCycle(addMonths(viewCycle.value.key, -1));
      else if (e.key === 'ArrowRight') selectCycle(addMonths(viewCycle.value.key, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="screen">
      <TopBar title="Daftar">
        <IconButton icon="wallet" label="Salary received" title onClick={() => openSalary()} />
        <IconButton icon="report" label="Month report" title href={reportHref(cycle.key)} />
      </TopBar>

      <LedgerBanners />
      <CycleSelector cycle={cycle} currentKey={currentCycle.value.key} onGo={selectCycle} />

      <div class="month-viewport">
        <div
          key={cycle.key}
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
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) selectCycle(addMonths(cycle.key, dx < 0 ? 1 : -1));
          }}
        >
          {isCurrent && <TodayGoal />}
          <SummaryNote
            totals={totals}
            left={leftOf(totals)}
            savingsBalance={balance}
            onLogSalary={isCurrent ? () => openSalary() : undefined}
          />

          {cycleEntries.length === 0 ? (
            <EmptyState title="Nothing written here yet.">
              <p>{isCurrent ? 'Tap the pen to write down what you spend.' : 'No entries in this cycle.'}</p>
            </EmptyState>
          ) : (
            <DayList groups={groupByDay(cycleEntries)} onEdit={editEntry} />
          )}
        </div>
      </div>

      <Fab icon="pen" label="Add expense" title="Add expense (N)" heat={goalHeatValue.value} onClick={() => openQuickAdd()} />
      <QuickAddSheet />
      <SalarySheet />
    </div>
  );
}
