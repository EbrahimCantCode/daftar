import { signal } from '@preact/signals';
import { isValidDate } from '../../../domain/dates';
import { amountError, filsToPlain, formatFils, parseFils } from '../../../domain/money';
import { cleanDescription } from '../../../domain/text';
import type { Entry } from '../../../domain/types';
import { addEntry, removeEntry, settings, today, updateEntry } from '../../../state/store';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { FormActions, FormRow, Hint } from '../../components/Form';
import { AmountInput, FieldError, TextInput } from '../../components/TextInput';
import { showToast } from '../../components/Toast';

const editing = signal<Entry | null>(null);
const amountText = signal('');
const descText = signal('');
const dateText = signal('');
const isSalary = signal(true);
const errors = signal<{ amount?: string; desc?: string; date?: string }>({});
const busy = signal(false);

let dialog: HTMLDialogElement | null = null;
let amountInput: HTMLInputElement | null = null;
let onSaved: ((date: string) => void) | undefined;

export function onIncomeSaved(fn: (date: string) => void) {
  onSaved = fn;
}

/** Opens "Salary received", prefilled with the usual salary and today, or an income entry to edit. */
export function openSalary(entry?: Entry, preset?: { date?: string; amountFils?: number }) {
  editing.value = entry ?? null;
  const amount = entry?.amountFils ?? preset?.amountFils ?? settings.value.usualSalaryFils;
  amountText.value = amount === undefined ? '' : filsToPlain(amount);
  descText.value = entry?.description ?? 'Salary';
  dateText.value = entry?.date ?? preset?.date ?? today.value;
  isSalary.value = entry ? !!entry.salary : true;
  errors.value = {};
  if (amountInput) amountInput.value = amountText.value;
  if (!dialog || dialog.open) return;
  dialog.showModal();
  amountInput?.focus();
  amountInput?.select();
}

async function save(e: Event) {
  e.preventDefault();
  if (busy.value) return;
  const amountFils = parseFils(amountText.value);
  const description = cleanDescription(descText.value);
  const date = dateText.value;
  const errs: typeof errors.value = {};
  if (amountFils === null) errs.amount = amountText.value.trim() ? amountError('850 or 850.500') : 'How much came in?';
  if (!description) errs.desc = 'What was it?';
  if (!isValidDate(date)) errs.date = 'Pick a date';
  errors.value = errs;
  if (errs.amount) return amountInput?.focus();
  if (errs.desc || errs.date) return;

  busy.value = true;
  try {
    const draft = { amountFils: amountFils!, description, date, type: 'income' as const, salary: isSalary.value };
    const current = editing.value;
    if (current) await updateEntry({ ...current, ...draft });
    else await addEntry(draft);
    showToast(current ? 'Saved' : `Wrote down ${formatFils(amountFils!)} coming in`);
    dialog?.close();
    onSaved?.(date);
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
  dialog?.close();
  const undo = await removeEntry(entry);
  showToast(`Crossed out “${entry.description}”`, { actionLabel: 'Undo', action: undo });
}

export function SalarySheet() {
  const entry = editing.value;
  const err = errors.value;
  return (
    <BottomSheet
      title={entry ? 'Edit income' : 'Salary received'}
      dialogRef={(el) => {
        dialog = el;
      }}
      onClose={() => {
        editing.value = null;
      }}
    >
      <form onSubmit={save} noValidate>
        <FormRow label="Amount" htmlFor="sal-amount">
          <AmountInput
            inputRef={(el) => {
              amountInput = el;
            }}
            id="sal-amount"
            value={amountText.value}
            invalid={!!err.amount}
            describedBy={err.amount ? 'sal-amount-err' : undefined}
            onInput={(v) => (amountText.value = v)}
          />
          {err.amount && <FieldError id="sal-amount-err">{err.amount}</FieldError>}
        </FormRow>

        <FormRow label="For" htmlFor="sal-desc">
          <TextInput
            id="sal-desc"
            autoComplete="off"
            autoCapitalize="sentences"
            maxLength={120}
            value={descText.value}
            invalid={!!err.desc}
            onInput={(v) => (descText.value = v)}
          />
          {err.desc && <FieldError>{err.desc}</FieldError>}
        </FormRow>

        <FormRow label="On" htmlFor="sal-date">
          <TextInput id="sal-date" type="date" required value={dateText.value} onInput={(v) => (dateText.value = v)} />
          {err.date && <FieldError>{err.date}</FieldError>}
        </FormRow>

        <FormRow label="">
          <Checkbox checked={isSalary.value} onChange={(v) => (isSalary.value = v)}>
            This is my salary (starts a new pay cycle)
          </Checkbox>
        </FormRow>
        {!isSalary.value && <Hint>Counts as income in the cycle it falls in, like a bonus or a refund.</Hint>}

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
