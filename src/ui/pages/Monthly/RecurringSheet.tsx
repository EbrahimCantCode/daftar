import { signal } from '@preact/signals';
import { ENTRY_TYPES, RECURRING_TYPE_IDS, inkVar } from '../../../domain/entryTypes';
import { amountError, filsToPlain, parseFils } from '../../../domain/money';
import { cleanDescription } from '../../../domain/text';
import { addRecurring, removeRecurring, updateRecurring } from '../../../state/store';
import type { RecurringItem, RecurringTiming, RecurringType } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { FormActions, FormRow, Hint } from '../../components/Form';
import { SegmentedControl } from '../../components/SegmentedControl';
import { AmountInput, FieldError, TextInput } from '../../components/TextInput';
import { showToast } from '../../components/Toast';

const editing = signal<RecurringItem | null>(null);
const nameText = signal('');
const amountText = signal('');
const dayText = signal('');
const type = signal<RecurringType>('fixed');
const timing = signal<RecurringTiming>('day');
const errors = signal<{ name?: string; amount?: string; day?: string }>({});
const confirmingDelete = signal(false);
const busy = signal(false);

let dialog: HTMLDialogElement | null = null;
let nameInput: HTMLInputElement | null = null;
let amountInput: HTMLInputElement | null = null;
let dayInput: HTMLInputElement | null = null;

export function openRecurring(item?: RecurringItem, preset?: { name: string; type: RecurringType; timing?: RecurringTiming }) {
  editing.value = item ?? null;
  nameText.value = item?.name ?? preset?.name ?? '';
  amountText.value = item ? filsToPlain(item.amountFils) : '';
  dayText.value = item ? String(item.dayOfMonth) : '1';
  type.value = item?.type ?? preset?.type ?? 'fixed';
  timing.value = item?.timing ?? preset?.timing ?? 'day';
  errors.value = {};
  confirmingDelete.value = false;
  if (!dialog || dialog.open) return;
  dialog.showModal();
  // With a preset name the next thing to fill in is the amount.
  (preset && !item ? amountInput : nameInput)?.focus();
}

/** Payday items don't use a day, but keep the last one so switching back restores it. */
const dayToKeep = (typed: number, fallback: number) => (timing.value === 'day' ? typed : Number.isInteger(typed) && typed >= 1 && typed <= 31 ? typed : fallback);

async function save(e: Event) {
  e.preventDefault();
  if (busy.value) return;
  const name = cleanDescription(nameText.value);
  const amountFils = parseFils(amountText.value);
  const day = Number(dayText.value);
  const errs: typeof errors.value = {};
  if (!name) errs.name = 'Give it a name';
  if (amountFils === null) errs.amount = amountError('25 or 6.500');
  if (timing.value === 'day' && (!Number.isInteger(day) || day < 1 || day > 31)) errs.day = 'A day from 1 to 31';
  errors.value = errs;
  if (errs.name) return nameInput?.focus();
  if (errs.amount) return amountInput?.focus();
  if (errs.day) return dayInput?.focus();

  busy.value = true;
  try {
    const current = editing.value;
    if (current) {
      await updateRecurring({ ...current, name, amountFils: amountFils!, dayOfMonth: dayToKeep(day, current.dayOfMonth), timing: timing.value, type: type.value });
      showToast('Saved. Applies from the next entry it writes.');
    } else {
      await addRecurring({ name, amountFils: amountFils!, dayOfMonth: dayToKeep(day, 1), timing: timing.value, type: type.value });
      showToast(`Added ${name}. This cycle’s entry is in the ledger.`);
    }
    dialog?.close();
  } catch (err) {
    console.error(err);
    showToast('Could not save. Please try again.');
  } finally {
    busy.value = false;
  }
}

async function remove() {
  const item = editing.value;
  if (!item) return;
  if (!confirmingDelete.value) {
    confirmingDelete.value = true;
    return;
  }
  await removeRecurring(item);
  dialog?.close();
  showToast(`Removed ${item.name}. Past entries stay in the ledger.`);
}

export function RecurringSheet() {
  const item = editing.value;
  const err = errors.value;
  return (
    <BottomSheet
      title={item ? 'Edit monthly item' : 'New monthly item'}
      dialogRef={(el) => {
        dialog = el;
      }}
      onClose={() => {
        editing.value = null;
      }}
    >
      <form onSubmit={save} noValidate>
        <FormRow label="Name" htmlFor="ri-name">
          <TextInput
            inputRef={(el) => {
              nameInput = el;
            }}
            id="ri-name"
            autoComplete="off"
            autoCapitalize="sentences"
            maxLength={80}
            placeholder="Gym, rent, savings…"
            value={nameText.value}
            invalid={!!err.name}
            describedBy={err.name ? 'ri-name-err' : undefined}
            onInput={(v) => (nameText.value = v)}
          />
          {err.name && <FieldError id="ri-name-err">{err.name}</FieldError>}
        </FormRow>

        <FormRow label="Amount" htmlFor="ri-amount">
          <AmountInput
            inputRef={(el) => {
              amountInput = el;
            }}
            id="ri-amount"
            value={amountText.value}
            invalid={!!err.amount}
            describedBy={err.amount ? 'ri-amount-err' : undefined}
            onInput={(v) => (amountText.value = v)}
          />
          {err.amount && <FieldError id="ri-amount-err">{err.amount}</FieldError>}
        </FormRow>

        <FormRow label="When">
          <SegmentedControl
            label="When"
            value={timing.value}
            onChange={(t) => (timing.value = t)}
            options={[
              { value: 'payday', label: 'On payday' },
              { value: 'day', label: 'On a day' },
            ]}
          />
        </FormRow>

        {timing.value === 'day' && (
          <FormRow label="Day" htmlFor="ri-day">
            <TextInput
              inputRef={(el) => {
                dayInput = el;
              }}
              id="ri-day"
              class="day-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              autoComplete="off"
              value={dayText.value}
              invalid={!!err.day}
              describedBy="ri-day-hint"
              onInput={(v) => (dayText.value = v)}
            />
            <p class={err.day ? 'field-error' : 'hint'} id="ri-day-hint">
              {err.day ?? 'Day of the month. 29–31 fall on the last day of shorter months.'}
            </p>
          </FormRow>
        )}

        <FormRow label="As">
          <SegmentedControl
            label="Type"
            value={type.value}
            onChange={(t) => (type.value = t)}
            options={RECURRING_TYPE_IDS.map((t) => ({ value: t, label: ENTRY_TYPES[t].label, ink: inkVar(t) }))}
          />
        </FormRow>

        {item && <Hint>Changes apply to entries written from now on. Entries already in the ledger stay as they are.</Hint>}

        <FormActions
          left={
            item && (
              <Button variant={confirmingDelete.value ? 'danger-solid' : 'danger'} icon="trash" onClick={remove}>
                {confirmingDelete.value ? 'Tap again to delete' : 'Delete'}
              </Button>
            )
          }
        >
          <Button type="submit" variant="primary" icon="check" disabled={busy.value}>
            {item ? 'Save' : 'Add'}
          </Button>
        </FormActions>
      </form>
    </BottomSheet>
  );
}
