import { signal } from '@preact/signals';
import { addMonths, monthLabel, monthOf } from '../lib/dates';
import { entriesInMonth } from '../lib/totals';
import { reportHref } from '../state/router';
import { entries, today } from '../state/store';
import { Icon } from './Icon';

const DISMISSED_KEY = 'daftar:report-dismissed';

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

const dismissed = signal(readDismissed());

/** On the 1st of the month, offers last month's report if last month has entries. */
export function ReportBanner() {
  const date = today.value;
  if (!date.endsWith('-01')) return null;
  const lastMonth = addMonths(monthOf(date), -1);
  if (dismissed.value === lastMonth || entriesInMonth(entries.value, lastMonth).length === 0) return null;

  const dismiss = () => {
    dismissed.value = lastMonth;
    try {
      localStorage.setItem(DISMISSED_KEY, lastMonth);
    } catch {
      // Without storage the banner just comes back on the next visit today.
    }
  };

  return (
    <aside class="report-banner" aria-label="Monthly report">
      <Icon name="report" />
      <p>
        {monthLabel(lastMonth).split(' ')[0]}’s report is ready.{' '}
        <a href={reportHref(lastMonth)} onClick={dismiss}>
          Tear it out
        </a>
      </p>
      <button type="button" class="icon-btn" aria-label="Dismiss" onClick={dismiss}>
        <Icon name="close" />
      </button>
    </aside>
  );
}
