import { PREF_KEYS } from '../../../data/prefs';
import { monthLabel } from '../../../domain/dates';
import { buildMonthReport } from '../../../domain/report';
import { href, reportMonth } from '../../../state/router';
import { entries, recurring, settings, today } from '../../../state/store';
import { ReportView } from '../../components/ReportView';
import { TopBar } from '../../components/TopBar';

/** The Month Report for one pay cycle. */
export function ReportPage() {
  const key = reportMonth.value!;
  return (
    <div class="screen">
      <TopBar title={`${monthLabel(key, { short: true })} ${key.slice(0, 4)} report`} back={href('reports')} />
      <p class="page-intro">Paste it into Claude to ask about this pay cycle. Made on this device; nothing is sent.</p>
      <ReportView
        build={(includeEntries) =>
          buildMonthReport({
            cycleKey: key,
            entries: entries.value,
            recurring: recurring.value,
            paydayDay: settings.value.paydayDay,
            startingSavingsFils: settings.value.startingSavingsFils,
            today: today.value,
            includeEntries,
          })
        }
        shareTitle={`Daftar report, ${monthLabel(key)}`}
        fileName={`daftar-report-${key}.md`}
        includePref={PREF_KEYS.reportIncludeEntries}
        includeByDefault
        label={`Report for ${monthLabel(key)}`}
      />
    </div>
  );
}
