import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { MAX_IMPORT_BYTES, downloadBackup } from '../../../data/backup';
import { parseImport, type ImportPreview } from '../../../domain/csv';
import { dayLabel, ordinal } from '../../../domain/dates';
import { amountError, filsToPlain, formatFils, parseFils } from '../../../domain/money';
import type { ImportMode, Theme } from '../../../domain/types';
import { eraseEverything, importSnapshot, persisted, settings, snapshot, today, updateSettings } from '../../../state/store';
import { Button, FileButton } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { SegmentedControl } from '../../components/SegmentedControl';
import { AmountInput, TextInput } from '../../components/TextInput';
import { showToast } from '../../components/Toast';
import { href } from '../../../state/router';
import { TopBar } from '../../components/TopBar';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Day' },
  { value: 'dark', label: 'Night' },
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A titled block on the settings page. */
function Setting({ title, titleId, titleTag = 'h2', titleClass, class: cls, children }: {
  title: ComponentChildren;
  titleId?: string;
  titleClass?: string;
  titleTag?: 'h2' | 'span' | 'label';
  class?: string;
  children: ComponentChildren;
}) {
  const Title = titleTag;
  return (
    <div class={`setting${cls ? ` ${cls}` : ''}`}>
      <Title class={`setting-label${titleClass ? ` ${titleClass}` : ''}`} id={titleId}>
        {title}
      </Title>
      {children}
    </div>
  );
}

interface AmountSettingProps {
  id: string;
  label: string;
  hint: string;
  value: number | undefined;
  example: string;
  onSave: (fils: number | undefined) => Promise<void>;
  savedMessage: (fils: number | undefined) => string;
}

/** An optional amount setting that saves on blur or Enter; empty clears it. */
function AmountSetting({ id, label, hint, value, example, onSave, savedMessage }: AmountSettingProps) {
  const [text, setText] = useState(value === undefined ? '' : filsToPlain(value));
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const trimmed = text.trim();
    const fils = trimmed ? parseFils(trimmed) : undefined;
    if (fils === null) {
      setError(amountError(example));
      return;
    }
    setError(null);
    if (fils !== undefined) setText(filsToPlain(fils));
    if (fils !== value) {
      await onSave(fils);
      showToast(savedMessage(fils));
    }
  };

  return (
    <div class="setting">
      <label class="setting-label" for={id}>
        {label}
      </label>
      <p class="hint" id={`${id}-hint`}>
        {error ? <span class="ink-red">{error}</span> : hint}
      </p>
      <div class="control income-control">
        <AmountInput
          id={id}
          value={text}
          invalid={!!error}
          describedBy={`${id}-hint`}
          onInput={setText}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
          }}
        />
      </div>
    </div>
  );
}

/** Expected payday: the day of the month the salary usually arrives. */
function PaydaySetting() {
  const [text, setText] = useState(String(settings.value.paydayDay));
  const [error, setError] = useState<string | null>(null);
  const commit = async () => {
    const day = Number(text.trim());
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError('A day from 1 to 31');
      return;
    }
    setError(null);
    if (day !== settings.value.paydayDay) {
      await updateSettings({ paydayDay: day });
      showToast(`Payday set to the ${ordinal(day)}`);
    }
  };
  return (
    <div class="setting">
      <label class="setting-label" for="payday">
        Expected payday
      </label>
      <p class="hint" id="payday-hint">
        {error ? (
          <span class="ink-red">{error}</span>
        ) : (
          'Day of the month your salary usually arrives. A cycle starts on the day you log your salary, up to 7 days early.'
        )}
      </p>
      <div class="control day-control">
        <TextInput
          id="payday"
          class="day-input"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="off"
          value={text}
          invalid={!!error}
          describedBy="payday-hint"
          onInput={setText}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
          }}
        />
      </div>
    </div>
  );
}

function ImportSection() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [withSettings, setWithSettings] = useState(true);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
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
    <Setting title="Backup">
      <p class="hint">Everything stays on this device. Export a CSV now and then to keep a copy.</p>
      <div class="button-row">
        <Button
          icon="download"
          onClick={() => {
            downloadBackup(snapshot(), today.value);
            showToast('Exported');
          }}
        >
          Export CSV
        </Button>
        <FileButton icon="upload" accept=".csv,text/csv" onFile={onFile}>
          Import CSV
        </FileButton>
      </div>

      {preview && (
        <section class="import-preview" aria-labelledby="import-title" aria-live="polite">
          <h3 id="import-title" class="hand">
            {fileName}
          </h3>
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
                <Button onClick={() => setPreview(null)}>OK</Button>
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
                    {preview.data.settings.usualSalaryFils !== undefined &&
                      ` (usual salary ${formatFils(preview.data.settings.usualSalaryFils)})`}
                  </li>
                )}
              </ul>
              {preview.legacy && <p class="hint">Written by the earlier, month-based version: it will be moved to pay cycles.</p>}
              <SegmentedControl
                label="Import mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'merge', label: 'Merge' },
                  { value: 'replace', label: 'Replace all' },
                ]}
              />
              <p class="hint">
                {mode === 'merge'
                  ? 'Adds these to your ledger. Rows with the same id are overwritten by the file.'
                  : 'Erases everything on this device first, then loads the file.'}
              </p>
              {preview.hasSettings && (
                <Checkbox checked={withSettings} onChange={setWithSettings}>
                  Also import settings (payday, salary, theme)
                </Checkbox>
              )}
              <div class="button-row">
                <Button variant="quiet" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
                <Button variant={mode === 'replace' ? 'danger-solid' : 'primary'} disabled={busy} onClick={confirm}>
                  {mode === 'replace' ? 'Replace and import' : 'Import'}
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </Setting>
  );
}

function EraseSection() {
  const [text, setText] = useState('');
  const armed = text.trim().toUpperCase() === 'ERASE';
  return (
    <Setting title="Erase all data" titleClass="ink-red" class="danger-zone">
      <p class="hint" id="erase-hint">
        Removes every entry, monthly item and setting from this device. This cannot be undone. Type <strong>ERASE</strong>{' '}
        to confirm.
      </p>
      <div class="button-row">
        <TextInput
          class="erase-input"
          autoComplete="off"
          autoCapitalize="characters"
          ariaLabel="Type ERASE to confirm"
          describedBy="erase-hint"
          value={text}
          onInput={setText}
        />
        <Button
          variant="danger-solid"
          icon="trash"
          disabled={!armed}
          onClick={async () => {
            await eraseEverything();
            setText('');
            showToast('All data erased');
          }}
        >
          Erase
        </Button>
      </div>
    </Setting>
  );
}

export function SettingsPage() {
  return (
    <div class="screen">
      <TopBar title="Settings" back={href('more')} />

      {/* Keyed on the stored value so an import or erase remounts the field with fresh text. */}
      <PaydaySetting key={`payday-${settings.value.paydayDay}`} />
      <AmountSetting
        key={`salary-${settings.value.usualSalaryFils}`}
        id="usual-salary"
        label="Usual salary"
        hint="Fills in “Salary received”. You can change the amount each time."
        example="850 or 850.500"
        value={settings.value.usualSalaryFils}
        onSave={(fils) => updateSettings({ usualSalaryFils: fils })}
        savedMessage={(fils) => (fils === undefined ? 'Usual salary cleared' : `Usual salary set to ${formatFils(fils)}`)}
      />
      <AmountSetting
        key={`savings-${settings.value.startingSavingsFils}`}
        id="starting-savings"
        label="Starting savings balance"
        hint="What you had in savings before your first savings entry. Daftar adds what you save and subtracts what you take out. Leave empty to hide the balance."
        example="2500 or 2500.750"
        value={settings.value.startingSavingsFils}
        onSave={(fils) => updateSettings({ startingSavingsFils: fils })}
        savedMessage={(fils) => (fils === undefined ? 'Savings balance hidden' : `Starting balance set to ${formatFils(fils)}`)}
      />
      <AmountSetting
        key={`goal-${settings.value.dailyGoalFils}`}
        id="daily-goal"
        label="Daily spending goal"
        hint="Try to spend no more than this each day. Only Spend entries count, not fixed or savings. Every day at or under it adds to your streak. Leave empty to turn it off."
        example="5 or 4.500"
        value={settings.value.dailyGoalFils}
        onSave={(fils) => updateSettings({ dailyGoalFils: fils })}
        savedMessage={(fils) => (fils === undefined ? 'Daily goal turned off' : `Daily goal set to ${formatFils(fils)}`)}
      />

      <Setting title="Paper" titleTag="span" titleId="theme-label">
        <SegmentedControl
          labelledBy="theme-label"
          value={settings.value.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={THEMES}
        />
      </Setting>

      <ImportSection />

      <Setting title="Storage">
        <p class="hint">
          {persisted.value === true
            ? 'Persistent storage is on: the browser will not clear Daftar to free up space.'
            : persisted.value === false
              ? 'The browser did not grant persistent storage, so it may clear data when space runs low. Installing Daftar to your home screen usually helps. Keep a CSV backup.'
              : 'Checking storage…'}
        </p>
      </Setting>

      <EraseSection />

      <p class="hint colophon">Daftar keeps your ledger on this device only. No account, no server.</p>
    </div>
  );
}
