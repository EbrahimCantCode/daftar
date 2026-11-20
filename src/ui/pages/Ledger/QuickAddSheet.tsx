import { signal } from '@preact/signals';
import { addDays, isValidDate, monthLabel, monthOf } from '../../../domain/dates';
import { ENTRY_TYPES, inkVar } from '../../../domain/entryTypes';
import { amountError, filsToPlain, formatFils, parseFils } from '../../../domain/money';
import { suggest } from '../../../domain/suggest';
import { cleanDescription } from '../../../domain/text';
import type { Entry, EntryType } from '../../../domain/types';
import { addEntry, removeEntry, suggestions, today, updateEntry } from '../../../state/store';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Chip, Chips } from '../../components/Chips';
import { FormActions, FormRow, Hint } from '../../components/Form';
import { SegmentedControl } from '../../components/SegmentedControl';
import { AmountInput, FieldError, TextInput } from '../../components/TextInput';
import { showToast } from '../../components/Toast';

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
  dateText.value = entry?.date ?? today.value;
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
    errs.amount = amountText.value.trim() ? amountError('3.250', { mentionDecimals: true }) : 'How much was it?';
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
  const todayDate = today.value;
  const yesterday = addDays(todayDate, -1);
  const chips = suggest(suggestions.value, descText.value, 8);
  const typeOptions: EntryType[] = entry?.type === 'fixed' ? ['spend', 'fixed', 'savings'] : ['spend', 'savings'];
  const err = errors.value;

  return (
    <BottomSheet
      title={entry ? 'Edit entry' : 'New entry'}
      dialogRef={(el) => {
        dialog = el;
      }}
      onClose={() => {
        editing.value = null;
      }}
    >
      <form onSubmit={save} noValidate>
        <FormRow label="Amount" htmlFor="qa-amount">
          <AmountInput
            inputRef={(el) => {
              amountInput = el;
            }}
            id="qa-amount"
            enterKeyHint="next"
            value={amountText.value}
            invalid={!!err.amount}
            describedBy={err.amount ? 'qa-amount-err' : undefined}
            onInput={(v) => (amountText.value = v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                descInput?.focus();
              }
            }}
          />
          {err.amount && <FieldError id="qa-amount-err">{err.amount}</FieldError>}
        </FormRow>

        <FormRow label="For" htmlFor="qa-desc">
          <TextInput
            inputRef={(el) => {
              descInput = el;
            }}
            id="qa-desc"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder="What was it for?"
            maxLength={120}
            value={descText.value}
            invalid={!!err.desc}
            describedBy={err.desc ? 'qa-desc-err' : undefined}
            onInput={(v) => (descText.value = v)}
          />
          {err.desc && <FieldError id="qa-desc-err">{err.desc}</FieldError>}
          {chips.length > 0 && (
            <Chips label="Suggestions">
              {chips.map((s) => (
                <Chip
                  key={s.key}
                  onClick={() => {
                    descText.value = s.label;
                    errors.value = { ...errors.value, desc: undefined };
                    descInput?.focus();
                  }}
                >
                  {s.label}
                </Chip>
              ))}
            </Chips>
          )}
        </FormRow>

        <FormRow label="On" htmlFor="qa-date" controlClass="date-row">
          <TextInput id="qa-date" type="date" required value={dateText.value} onInput={(v) => (dateText.value = v)} />
          {dateText.value !== todayDate && <Chip onClick={() => (dateText.value = todayDate)}>Today</Chip>}
          {dateText.value === todayDate && <Chip onClick={() => (dateText.value = yesterday)}>Yesterday</Chip>}
          {err.date && <FieldError>{err.date}</FieldError>}
        </FormRow>

        <FormRow label="As">
          <SegmentedControl
            label="Type"
            value={type.value}
            onChange={(t) => (type.value = t)}
            options={typeOptions.map((t) => ({ value: t, label: ENTRY_TYPES[t].label, ink: inkVar(t) }))}
          />
        </FormRow>

        {entry?.recurringId && (
          <Hint>This is the {monthLabel(monthOf(entry.date))} entry of a monthly item. Changes here only affect this month.</Hint>
        )}

        <FormActions
          left={
            entry && (
              <Button variant="danger" icon="trash" onClick={remove}>
                Delete
              </Button>
            )
          }
        >
          <Button type="submit" variant="primary" icon="check" disabled={busy.value}>
            {entry ? 'Save' : 'Write it down'}
          </Button>
        </FormActions>
      </form>
    </BottomSheet>
  );
}
