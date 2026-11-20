import { useState } from 'preact/hooks';
import { copyText, downloadText } from '../../data/files';
import { readPref, writePref } from '../../data/prefs';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { showToast } from './Toast';

interface ReportViewProps {
  /** Builds the Markdown, with or without the full entry list. */
  build: (includeEntries: boolean) => string;
  /** Title used when sharing. */
  shareTitle: string;
  fileName: string;
  /** Where the "Include all entries" choice is remembered, and its default. */
  includePref: string;
  includeByDefault: boolean;
  label: string;
}

/** Copy / Share / Download actions, the entries toggle, and the report on a torn-out page. */
export function ReportView({ build, shareTitle, fileName, includePref, includeByDefault, label }: ReportViewProps) {
  const [includeEntries, setIncludeEntries] = useState(() => {
    const saved = readPref(includePref);
    return saved === null ? includeByDefault : saved === 'true';
  });
  const report = build(includeEntries);
  const canShare = typeof navigator.share === 'function';

  return (
    <>
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
                await navigator.share({ title: shareTitle, text: report });
              } catch (err) {
                if ((err as Error).name !== 'AbortError') showToast('Could not share. Try Copy instead.');
              }
            }}
          >
            Share
          </Button>
        )}
        <Button icon="download" onClick={() => downloadText(report, fileName, 'text/markdown;charset=utf-8')}>
          Download
        </Button>
      </div>

      <Checkbox
        class="report-toggle"
        checked={includeEntries}
        onChange={(checked) => {
          setIncludeEntries(checked);
          writePref(includePref, String(checked));
        }}
      >
        Include all entries
      </Checkbox>

      <article class="torn-page" aria-label={label}>
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
    </>
  );
}
