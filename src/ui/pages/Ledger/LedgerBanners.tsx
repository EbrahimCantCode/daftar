import { signal } from '@preact/signals';
import { PREF_KEYS, readPref, writePref } from '../../../data/prefs';
import { addMonths, monthLabel } from '../../../domain/dates';
import { cycleByKey, daysElapsed, entriesInCycle, salaryDueCycle } from '../../../domain/cycles';
import { formatFils } from '../../../domain/money';
import { shortDate } from '../../../domain/markdown';
import { reportHref } from '../../../state/router';
import { currentCycle, cycleCtx, entries, settings, today, updateSettings } from '../../../state/store';
import { Banner } from '../../components/Banner';
import { openSalary } from './SalarySheet';

const paydayDismissed = signal(readPref(PREF_KEYS.paydayDismissed));
const reportDismissed = signal(readPref(PREF_KEYS.reportDismissed));

const monthName = (key: string) => monthLabel(key).split(' ')[0]!;

/** At most one note at the top of the ledger, most useful first. */
export function LedgerBanners() {
  const ctx = cycleCtx.value;
  const current = currentCycle.value;
  const s = settings.value;
  const cycleEntries = entriesInCycle(entries.value, current);
  const hasIncome = cycleEntries.some((e) => e.type === 'income');

  // Once, right after moving to pay cycles: add the current cycle's salary.
  if (s.salaryOfferPending && !hasIncome) {
    const amount = s.usualSalaryFils;
    const dismiss = () => updateSettings({ salaryOfferPending: undefined });
    return (
      <Banner icon="wallet" label="Add this cycle's salary" onDismiss={dismiss}>
        Add your {monthName(current.key)} salary{amount !== undefined ? `: ${formatFils(amount)}` : ''} on {shortDate(current.start)}?{' '}
        <button type="button" class="banner-link" onClick={() => openSalary(undefined, { date: current.start })}>
          Add it
        </button>
      </Banner>
    );
  }

  const due = salaryDueCycle(today.value, ctx);
  if (due && paydayDismissed.value !== due) {
    const dismiss = () => {
      paydayDismissed.value = due;
      writePref(PREF_KEYS.paydayDismissed, due);
    };
    return (
      <Banner icon="wallet" label="Payday" onDismiss={dismiss}>
        Got paid?{' '}
        <button type="button" class="banner-link" onClick={() => openSalary()}>
          Log your salary
        </button>
      </Banner>
    );
  }

  // In the first days of a cycle, offer the report for the one that just ended.
  const previous = addMonths(current.key, -1);
  if (
    daysElapsed(current, today.value) <= 3 &&
    reportDismissed.value !== previous &&
    entriesInCycle(entries.value, cycleByKey(previous, ctx)).length > 0
  ) {
    const dismiss = () => {
      reportDismissed.value = previous;
      writePref(PREF_KEYS.reportDismissed, previous);
    };
    return (
      <Banner icon="report" label="Cycle report" onDismiss={dismiss}>
        {monthName(previous)}’s report is ready.{' '}
        <a href={reportHref(previous)} onClick={dismiss}>
          Tear it out
        </a>
      </Banner>
    );
  }
  return null;
}
