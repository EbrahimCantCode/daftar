import { signal } from '@preact/signals';
import { PREF_KEYS, readPref, writePref } from '../../../data/prefs';
import { addMonths, monthLabel, monthOf } from '../../../domain/dates';
import { entriesInMonth } from '../../../domain/totals';
import { reportHref } from '../../../state/router';
import { entries, today } from '../../../state/store';
import { Banner } from '../../components/Banner';

const dismissed = signal(readPref(PREF_KEYS.reportDismissed));

/** On the 1st of the month, offers last month's report if last month has entries. */
export function ReportBanner() {
  const date = today.value;
  if (!date.endsWith('-01')) return null;
  const lastMonth = addMonths(monthOf(date), -1);
  if (dismissed.value === lastMonth || entriesInMonth(entries.value, lastMonth).length === 0) return null;

  const dismiss = () => {
    dismissed.value = lastMonth;
    writePref(PREF_KEYS.reportDismissed, lastMonth);
  };

  return (
    <Banner icon="report" label="Monthly report" onDismiss={dismiss}>
      {monthLabel(lastMonth).split(' ')[0]}’s report is ready.{' '}
      <a href={reportHref(lastMonth)} onClick={dismiss}>
        Tear it out
      </a>
    </Banner>
  );
}
