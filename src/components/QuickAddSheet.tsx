import { signal } from '@preact/signals';
import { now } from '../lib/clock';
import { isValidDate, monthLabel, monthOf, todayISO } from '../lib/dates';
import { filsToPlain, formatFils, parseFils } from '../lib/money';
import { suggest } from '../lib/suggest';
import { cleanDescription } from '../lib/text';
import { addEntry, removeEntry, suggestions, updateEntry } from '../state/store';
import type { Entry, EntryType } from '../types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

const editing = signal<Entry | null>(null);
const amountText = signal('');
const descText = signal('');
const dateText = signal('');
const type = signal<EntryType>('spend');
const errors = signal<{ amount?: string; desc?: string; date?: string }>({});
const busy = signal(false);

let dialog: HTMLDialogElement | null = null;
let amountInput: HTMLInputElement | null = null;
let descInput: HTMLInputElement | null = null;
let onSavedMonth: ((month: string) => void) | undefined;

/** Called when an entry is saved into a month, so the ledger can turn to it. */
export function onEntrySaved(fn: (month: string) => void) {
  onSavedMonth = fn;
}

/**
 * Opens the sheet synchronously (inside the tap handler) and focuses the amount,
 * so the numeric keypad comes up straight away on iOS and Android.
 */
export function openQuickAdd(entry?: Entry) {
  editing.value = entry ?? null;
  amountText.value = entry ? filsToPlain(entry.amountFils) : '';
  descText.value = entry?.description ?? '';
  dateText.value = entry?.date ?? todayISO(now());
  type.value = entry?.type ?? 'spend';
  errors.value = {};
  if (amountInput) amountInput.value = amountText.value;
  if (!dialog || dialog.open) return;
  dialog.showModal();
  amountInput?.focus();
  if (entry) amountInput?.select();
}

function close() {
  dialog?.close();
}

async function save(e: Event) {
  e.preventDefault();
  if (busy.value) return;
  const amountFils = parseFils(amountText.value);
  const description = cleanDescription(descText.value);
  const date = dateText.value;
  const errs: typeof errors.value = {};
  if (amountFils === null) {
    errs.amount = amountText.value.trim() ? 'Use a positive amount with up to 3 decimals, like 3.250' : 'How much was it?';
  }
  if (!description) errs.desc = 'What was it for?';
  if (!isValidDate(date)) errs.date = 'Pick a date';
  errors.value = errs;
  if (errs.amount) return amountInput?.focus();
  if (errs.desc) return descInput?.focus();
  if (errs.date) return;

  busy.value = true;
  try {
    const current = editing.value;
    if (current) {
      await updateEntry({ ...current, amountFils: amountFils!, description, date, type: type.value });
      showToast('Saved');
    } else {
      await addEntry({ amountFils: amountFils!, description, date, type: type.value });
      showToast(`Wrote down ${formatFils(amountFils!)} · ${description}`);
    }
    close();
    onSavedMonth?.(monthOf(date));
  } catch (err) {
    console.error(err);
    showToast('Could not save. Please try again.');
  } finally {
    busy.value = false;
  }
}

async function remove() {
  const entry = editing.value;
  if (!entry) return;
  close();
  const undo = await removeEntry(entry);
  showToast(`Crossed out “${entry.description}”`, { actionLabel: 'Undo', action: undo });
}

export function QuickAddSheet() {
  const entry = editing.value;
  const today = todayISO(now());
  const y = now();
  y.setDate(y.getDate() - 1);
  const yesterday = todayISO(y);
  const chips = suggest(suggestions.value, descText.value, 8);
  const typeOptions: EntryType[] = entry?.type === 'fixed' ? ['spend', 'fixed', 'savings'] : ['spend', 'savings'];
  const err = errors.value;

  return (
    <Sheet
      title={entry ? 'Edit entry' : 'New entry'}
      dialogRef={(el) => {
        dialog = el;
      }}
      onClose={() => {
        editing.value = null;
      }}
    >
      <form onSubmit={save} noValidate>
        <div class="form-row">
          <label for="qa-amount">Amount</label>
          <div class="control">
            <input
              ref={(el) => {
                amountInput = el;
              }}
              id="qa-amount"
              class="field-input amount-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="0.000"
              value={amountText.value}
              aria-invalid={err.amount ? 'true' : undefined}
              aria-describedby={err.amount ? 'qa-amount-err' : undefined}
              onInput={(e) => (amountText.value = e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  descInput?.focus();
                }
              }}
            />
            <span class="suffix" aria-hidden="true">
              BD
            </span>
            {err.amount && (
              <p class="field-error" id="qa-amount-err">
                {err.amount}
              </p>
            )}
          </div>
        </div>

        <div class="form-row">
          <label for="qa-desc">For</label>
          <div class="control">
            <input
              ref={(el) => {
                descInput = el;
              }}
              id="qa-desc"
              class="field-input"
              type="text"
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="done"
              placeholder="What was it for?"
              maxLength={120}
              value={descText.value}
              aria-invalid={err.desc ? 'true' : undefined}
              aria-describedby={err.desc ? 'qa-desc-err' : undefined}
              onInput={(e) => (descText.value = e.currentTarget.value)}
            />
            {err.desc && (
              <p class="field-error" id="qa-desc-err">
                {err.desc}
              </p>
            )}
            {chips.length > 0 && (
              <div class="chips" role="group" aria-label="Suggestions">
                {chips.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    class="chip"
                    onClick={() => {
                      descText.value = s.label;
                      errors.value = { ...errors.value, desc: undefined };
                      descInput?.focus();
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="form-row">
          <label for="qa-date">On</label>
          <div class="control date-row">
            <input
              id="qa-date"
              class="field-input"
              type="date"
              required
              value={dateText.value}
              onInput={(e) => (dateText.value = e.currentTarget.value)}
            />
            {dateText.value !== today && (
              <button type="button" class="chip" onClick={() => (dateText.value = today)}>
                Today
              </button>
            )}
            {dateText.value === today && (
              <button type="button" class="chip" onClick={() => (dateText.value = yesterday)}>
                Yesterday
              </button>
            )}
            {err.date && <p class="field-error">{err.date}</p>}
          </div>
        </div>

        <div class="form-row">
          <span class="label">As</span>
          <div class="control">
            <div class="toggle" role="group" aria-label="Type">
              {typeOptions.map((t) => (
                <button key={t} type="button" class={`is-${t}`} aria-pressed={type.value === t} onClick={() => (type.value = t)}>
                  {t === 'spend' ? 'Spend' : t === 'savings' ? 'Savings' : 'Fixed'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {entry?.recurringId && (
          <p class="hint">
            This is the {monthLabel(monthOf(entry.date))} entry of a monthly item. Changes here only affect this month.
          </p>
        )}

        <div class="card-actions">
          {entry ? (
            <button type="button" class="ink-btn danger" onClick={remove}>
              <Icon name="trash" />
              Delete
            </button>
          ) : (
            <span class="spacer" />
          )}
          <button type="submit" class="ink-btn primary" disabled={busy.value}>
            <Icon name="check" />
            {entry ? 'Save' : 'Write it down'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
