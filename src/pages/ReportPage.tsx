import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { monthLabel } from '../lib/dates';
import { buildMonthReport } from '../lib/report';
import { reportMonth } from '../state/router';
import { entries, recurring, settings, today } from '../state/store';

const INCLUDE_KEY = 'daftar:report-include-entries';

function loadInclude(): boolean {
  try {
    return localStorage.getItem(INCLUDE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function saveInclude(value: boolean) {
  try {
    localStorage.setItem(INCLUDE_KEY, String(value));
  } catch {
    // Not remembered in private mode; the toggle still works for this visit.
  }
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Older iOS and non-secure origins: fall back to a hidden textarea.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Copy failed');
}

function download(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ReportPage() {
  const month = reportMonth.value!;
  const [includeEntries, setIncludeEntries] = useState(loadInclude);
  const report = buildMonthReport({
    month,
    entries: entries.value,
    recurring: recurring.value,
    incomeFils: settings.value.monthlyIncomeFils,
    today: today.value,
    includeEntries,
  });
  const title = `Daftar report, ${monthLabel(month)}`;
  const canShare = typeof navigator.share === 'function';

  return (
    <div class="screen">
      <TopBar title={`${monthLabel(month, { short: true })} ${month.slice(0, 4)} report`} back />
      <p class="page-intro">Paste it into Claude to ask about your month. Made on this device; nothing is sent.</p>

      <div class="report-actions">
        <button
          type="button"
          class="ink-btn primary"
          onClick={async () => {
            try {
              await copyText(report);
              showToast('Copied ✓');
            } catch {
              showToast('Could not copy. Try Download instead.');
            }
          }}
        >
          <Icon name="copy" />
          Copy
        </button>
        {canShare && (
          <button
            type="button"
            class="ink-btn"
            onClick={async () => {
              try {
                await navigator.share({ title, text: report });
              } catch (err) {
                if ((err as Error).name !== 'AbortError') showToast('Could not share. Try Copy instead.');
              }
            }}
          >
            <Icon name="share" />
            Share
          </button>
        )}
        <button type="button" class="ink-btn" onClick={() => download(report, `daftar-report-${month}.md`)}>
          <Icon name="download" />
          Download
        </button>
      </div>

      <label class="check report-toggle">
        <input
          type="checkbox"
          checked={includeEntries}
          onChange={(e) => {
            setIncludeEntries(e.currentTarget.checked);
            saveInclude(e.currentTarget.checked);
          }}
        />
        Include all entries
      </label>

      <article class="torn-page" aria-label={`Report for ${monthLabel(month)}`}>
        {/* Table rows keep their shape and scroll sideways; prose lines wrap. */}
        <pre class="report-text" tabIndex={0}>
          {report.replace(/\n$/, '').split('\n').map((line, i) => (
            <span key={i} class={line.startsWith('|') ? 'report-row' : 'report-prose'}>
              {`${line}\n`}
            </span>
          ))}
        </pre>
      </article>
    </div>
  );
}
