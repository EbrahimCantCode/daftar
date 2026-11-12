import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Breakdown } from '../components/Breakdown';
import { DayList } from '../components/DayList';
import { Icon } from '../components/Icon';
import { MonthNav } from '../components/MonthNav';
import { QuickAddSheet, onEntrySaved, openQuickAdd } from '../components/QuickAddSheet';
import { SummaryNote } from '../components/SummaryNote';
import { TopBar } from '../components/TopBar';
import { now } from '../lib/clock';
import { addMonths, currentMonth } from '../lib/dates';
import { breakdown, entriesInMonth, groupByDay, leftThisMonth, monthTotals } from '../lib/totals';
import { href } from '../state/router';
import { entries, settings } from '../state/store';

const viewMonth = signal(currentMonth(now()));
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
  const thisMonth = currentMonth(now());
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
        <a class="icon-btn" href={href('monthly')} aria-label="Monthly items" title="Monthly items">
          <Icon name="repeat" />
        </a>
        <a class="icon-btn" href={href('settings')} aria-label="Settings" title="Settings">
          <Icon name="gear" />
        </a>
      </TopBar>

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
          <SummaryNote totals={totals} left={left} />

          {monthEntries.length === 0 ? (
            <div class="empty">
              <p class="hand">Nothing written here yet.</p>
              <p>{month === thisMonth ? 'Tap the pen to write down what you spend.' : 'No entries this month.'}</p>
            </div>
          ) : (
            <>
              <DayList groups={groupByDay(monthEntries)} onEdit={openQuickAdd} />
              <Breakdown rows={breakdown(monthEntries)} totalFils={totals.totalOutFils} />
            </>
          )}
        </div>
      </div>

      <button type="button" class="fab" aria-label="Add expense" title="Add expense (N)" onClick={() => openQuickAdd()}>
        <Icon name="pen" />
      </button>
      <QuickAddSheet />
    </div>
  );
}
