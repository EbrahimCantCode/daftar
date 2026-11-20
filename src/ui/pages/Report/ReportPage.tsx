import { useState } from 'preact/hooks';
import { copyText, downloadText } from '../../../data/files';
import { PREF_KEYS, readPref, writePref } from '../../../data/prefs';
import { monthLabel } from '../../../domain/dates';
import { buildMonthReport } from '../../../domain/report';
import { href, reportMonth } from '../../../state/router';
import { entries, recurring, settings, today } from '../../../state/store';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { showToast } from '../../components/Toast';
import { TopBar } from '../../components/TopBar';

export function ReportPage() {
  const month = reportMonth.value!;
  const [includeEntries, setIncludeEntries] = useState(() => readPref(PREF_KEYS.reportIncludeEntries) !== 'false');
  const report = buildMonthReport({
    cycleKey: month,
    entries: entries.value,
    recurring: recurring.value,
    paydayDay: settings.value.paydayDay,
    startingSavingsFils: settings.value.startingSavingsFils,
    today: today.value,
    includeEntries,
  });
  const title = `Daftar report, ${monthLabel(month)}`;
  const canShare = typeof navigator.share === 'function';

  return (
    <div class="screen">
      <TopBar title={`${monthLabel(month, { short: true })} ${month.slice(0, 4)} report`} back={href('reports')} />
      <p class="page-intro">Paste it into Claude to ask about this pay cycle. Made on this device; nothing is sent.</p>

      <div class="report-actions">
        <Button
          variant="primary"
          icon="copy"
          onClick={async () => {
            try {
              await copyText(report);
              showToast('Copied ✓');
            } catch {
              showToast('Could not copy. Try Download instead.');
            }
          }}
        >
          Copy
        </Button>
        {canShare && (
          <Button
            icon="share"
            onClick={async () => {
              try {
                await navigator.share({ title, text: report });
              } catch (err) {
                if ((err as Error).name !== 'AbortError') showToast('Could not share. Try Copy instead.');
              }
            }}
          >
            Share
          </Button>
        )}
        <Button icon="download" onClick={() => downloadText(report, `daftar-report-${month}.md`, 'text/markdown;charset=utf-8')}>
          Download
        </Button>
      </div>

      <Checkbox
        class="report-toggle"
        checked={includeEntries}
        onChange={(checked) => {
          setIncludeEntries(checked);
          writePref(PREF_KEYS.reportIncludeEntries, String(checked));
        }}
      >
        Include all entries
      </Checkbox>

      <article class="torn-page" aria-label={`Report for ${monthLabel(month)}`}>
        {/* Table rows keep their shape and scroll sideways; prose lines wrap. */}
        <pre class="report-text" tabIndex={0}>
          {report
            .replace(/\n$/, '')
            .split('\n')
            .map((line, i) => (
              <span key={i} class={line.startsWith('|') ? 'report-row' : 'report-prose'}>
                {`${line}\n`}
              </span>
            ))}
        </pre>
      </article>
    </div>
  );
}
