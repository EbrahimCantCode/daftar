import { PREF_KEYS } from '../../../data/prefs';
import { buildYearReport } from '../../../domain/yearReport';
import { href, reportYear } from '../../../state/router';
import { entries, recurring, settings, today } from '../../../state/store';
import { ReportView } from '../../components/ReportView';
import { TopBar } from '../../components/TopBar';

/** The Year Report: the cycles named after a year's months. */
export function YearReportPage() {
  const year = reportYear.value!;
  return (
    <div class="screen">
      <TopBar title={`${year} report`} back={href('reports')} />
      <p class="page-intro">The whole year, cycle by cycle. Paste it into Claude to ask about your year.</p>
      <ReportView
        build={(includeEntries) =>
          buildYearReport({
            year,
            entries: entries.value,
            recurring: recurring.value,
            paydayDay: settings.value.paydayDay,
            startingSavingsFils: settings.value.startingSavingsFils,
            today: today.value,
            includeEntries,
          })
        }
        shareTitle={`Daftar report, ${year}`}
        fileName={`daftar-report-${year}.md`}
        includePref={PREF_KEYS.yearReportIncludeEntries}
        includeByDefault={false}
        label={`Report for ${year}`}
      />
    </div>
  );
}
