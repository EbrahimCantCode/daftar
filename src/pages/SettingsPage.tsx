import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { showToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import type { ImportMode } from '../db/db';
import { now } from '../lib/clock';
import { parseImport, toCsv, type ImportPreview } from '../lib/csv';
import { dayLabel, todayISO } from '../lib/dates';
import { filsToPlain, formatFils, parseFils } from '../lib/money';
import { eraseEverything, importSnapshot, persisted, settings, snapshot, updateSettings } from '../state/store';
import type { Theme } from '../types';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function IncomeField() {
  const income = settings.value.monthlyIncomeFils;
  const [text, setText] = useState(income === undefined ? '' : filsToPlain(income));
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(null);
      if (income !== undefined) {
        await updateSettings({ monthlyIncomeFils: undefined });
        showToast('Income cleared');
      }
      return;
    }
    const fils = parseFils(trimmed);
    if (fils === null) {
      setError('Use a positive amount, like 850 or 850.500');
      return;
    }
    setError(null);
    setText(filsToPlain(fils));
    if (fils !== income) {
      await updateSettings({ monthlyIncomeFils: fils });
      showToast(`Income set to ${formatFils(fils)}`);
    }
  };

  return (
    <div class="setting">
      <label class="setting-label" for="income">
        Monthly income
      </label>
      <p class="hint" id="income-hint">
        {error ? <span class="ink-red">{error}</span> : 'Used for “Left this month”. Leave empty to hide it.'}
      </p>
      <div class="control income-control">
        <input
          id="income"
          class="field-input amount-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.000"
          value={text}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby="income-hint"
          onInput={(e) => setText(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
          }}
        />
        <span class="suffix" aria-hidden="true">
          BD
        </span>
      </div>
    </div>
  );
}

function exportCsv() {
  const blob = new Blob([toCsv(snapshot())], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daftar-${todayISO(now())}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  showToast('Exported');
}

function ImportSection() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [withSettings, setWithSettings] = useState(true);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast('That file is too large to be a Daftar export.');
      return;
    }
    setFileName(file.name);
    setPreview(parseImport(await file.text()));
    setMode('merge');
    setWithSettings(true);
  };

  const confirm = async () => {
    if (!preview || preview.errors.length) return;
    setBusy(true);
    try {
      await importSnapshot(preview.data, mode, preview.hasSettings && withSettings);
      showToast(`Imported ${preview.data.entries.length} ${plural(preview.data.entries.length, 'entry', 'entries')}`);
      setPreview(null);
    } catch (err) {
      console.error(err);
      showToast('Import failed. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="setting">
      <h3 class="setting-label">Backup</h3>
      <p class="hint">Everything stays on this device. Export a CSV now and then to keep a copy.</p>
      <div class="button-row">
        <button type="button" class="ink-btn" onClick={exportCsv}>
          <Icon name="download" />
          Export CSV
        </button>
        <label class="ink-btn file-btn">
          <Icon name="upload" />
          Import CSV
          <input type="file" accept=".csv,text/csv" class="visually-hidden" onChange={onFile} />
        </label>
      </div>

      {preview && (
        <section class="import-preview" aria-labelledby="import-title" aria-live="polite">
          <h4 id="import-title" class="hand">
            {fileName}
          </h4>
          {preview.errors.length > 0 ? (
            <>
              <p class="ink-red">
                This file has {preview.errors.length} problem{preview.errors.length === 1 ? '' : 's'}, so nothing will be imported:
              </p>
              <ul class="error-list">
                {preview.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>
                    {e.line > 0 && <strong>Line {e.line}: </strong>}
                    {e.message}
                  </li>
                ))}
                {preview.errors.length > 8 && <li>…and {preview.errors.length - 8} more.</li>}
              </ul>
              <div class="button-row">
                <button type="button" class="ink-btn" onClick={() => setPreview(null)}>
                  OK
                </button>
              </div>
            </>
          ) : (
            <>
              <ul class="import-facts">
                <li>
                  <strong>{preview.data.entries.length}</strong> {plural(preview.data.entries.length, 'entry', 'entries')}
                  {preview.firstDate && preview.lastDate && (
                    <span class="muted">
                      {' '}
                      ({dayLabel(preview.firstDate)} {preview.firstDate.slice(0, 4)} – {dayLabel(preview.lastDate)}{' '}
                      {preview.lastDate.slice(0, 4)})
                    </span>
                  )}
                </li>
                <li>
                  <strong>{preview.data.recurring.length}</strong> monthly {plural(preview.data.recurring.length, 'item', 'items')}
                </li>
                {preview.hasSettings && (
                  <li>
                    Settings
                    {preview.data.settings.monthlyIncomeFils !== undefined &&
                      ` (income ${formatFils(preview.data.settings.monthlyIncomeFils)})`}
                  </li>
                )}
              </ul>
              <div class="toggle" role="group" aria-label="Import mode">
                <button type="button" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
                  Merge
                </button>
                <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
                  Replace all
                </button>
              </div>
              <p class="hint">
                {mode === 'merge'
                  ? 'Adds these to your ledger. Rows with the same id are overwritten by the file.'
                  : 'Erases everything on this device first, then loads the file.'}
              </p>
              {preview.hasSettings && (
                <label class="check">
                  <input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.currentTarget.checked)} />
                  Also import settings (income, theme)
                </label>
              )}
              <div class="button-row">
                <button type="button" class="ink-btn quiet" onClick={() => setPreview(null)}>
                  Cancel
                </button>
                <button type="button" class={`ink-btn ${mode === 'replace' ? 'danger solid' : 'primary'}`} disabled={busy} onClick={confirm}>
                  {mode === 'replace' ? 'Replace and import' : 'Import'}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function EraseSection() {
  const [text, setText] = useState('');
  const armed = text.trim().toUpperCase() === 'ERASE';
  return (
    <div class="setting danger-zone">
      <h3 class="setting-label ink-red">Erase all data</h3>
      <p class="hint" id="erase-hint">
        Removes every entry, monthly item and setting from this device. This cannot be undone. Type <strong>ERASE</strong>{' '}
        to confirm.
      </p>
      <div class="button-row">
        <input
          class="field-input erase-input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          aria-label="Type ERASE to confirm"
          aria-describedby="erase-hint"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button
          type="button"
          class="ink-btn danger solid"
          disabled={!armed}
          onClick={async () => {
            await eraseEverything();
            setText('');
            showToast('All data erased');
          }}
        >
          <Icon name="trash" />
          Erase
        </button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const theme = settings.value.theme;
  return (
    <div class="screen">
      <TopBar title="Settings" back />

      {/* Remount when income changes elsewhere (import, erase) so the field shows the stored value. */}
      <IncomeField key={String(settings.value.monthlyIncomeFils)} />

      <div class="setting">
        <span class="setting-label" id="theme-label">
          Paper
        </span>
        <div class="toggle" role="group" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button key={t.value} type="button" aria-pressed={theme === t.value} onClick={() => updateSettings({ theme: t.value })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ImportSection />

      <div class="setting">
        <h3 class="setting-label">Storage</h3>
        <p class="hint">
          {persisted.value === true
            ? 'Persistent storage is on: the browser will not clear Daftar to free up space.'
            : persisted.value === false
              ? 'The browser did not grant persistent storage, so it may clear data when space runs low. Installing Daftar to your home screen usually helps. Keep a CSV backup.'
              : 'Checking storage…'}
        </p>
      </div>

      <EraseSection />

      <p class="hint colophon">Daftar keeps your ledger on this device only. No account, no server.</p>
    </div>
  );
}
