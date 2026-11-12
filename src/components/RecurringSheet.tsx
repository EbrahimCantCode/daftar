import { signal } from '@preact/signals';
import { filsToPlain, parseFils } from '../lib/money';
import { cleanDescription } from '../lib/text';
import { addRecurring, removeRecurring, updateRecurring } from '../state/store';
import type { RecurringItem, RecurringType } from '../types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

const editing = signal<RecurringItem | null>(null);
const nameText = signal('');
const amountText = signal('');
const dayText = signal('');
const type = signal<RecurringType>('fixed');
const errors = signal<{ name?: string; amount?: string; day?: string }>({});
const confirmingDelete = signal(false);
const busy = signal(false);

let dialog: HTMLDialogElement | null = null;
let nameInput: HTMLInputElement | null = null;
let amountInput: HTMLInputElement | null = null;
let dayInput: HTMLInputElement | null = null;

export function openRecurring(item?: RecurringItem, preset?: { name: string; type: RecurringType }) {
  editing.value = item ?? null;
  nameText.value = item?.name ?? preset?.name ?? '';
  amountText.value = item ? filsToPlain(item.amountFils) : '';
  dayText.value = item ? String(item.dayOfMonth) : '1';
  type.value = item?.type ?? preset?.type ?? 'fixed';
  errors.value = {};
  confirmingDelete.value = false;
  if (!dialog || dialog.open) return;
  dialog.showModal();
  // With a preset name the next thing to fill in is the amount.
  (preset && !item ? amountInput : nameInput)?.focus();
}

async function save(e: Event) {
  e.preventDefault();
  if (busy.value) return;
  const name = cleanDescription(nameText.value);
  const amountFils = parseFils(amountText.value);
  const day = Number(dayText.value);
  const errs: typeof errors.value = {};
  if (!name) errs.name = 'Give it a name';
  if (amountFils === null) errs.amount = 'Use a positive amount, like 25 or 6.500';
  if (!Number.isInteger(day) || day < 1 || day > 31) errs.day = 'A day from 1 to 31';
  errors.value = errs;
  if (errs.name) return nameInput?.focus();
  if (errs.amount) return amountInput?.focus();
  if (errs.day) return dayInput?.focus();

  busy.value = true;
  try {
    const current = editing.value;
    if (current) {
      await updateRecurring({ ...current, name, amountFils: amountFils!, dayOfMonth: day, type: type.value });
      showToast('Saved. Applies from the next entry it writes.');
    } else {
      await addRecurring({ name, amountFils: amountFils!, dayOfMonth: day, type: type.value });
      showToast(`Added ${name}. This month’s entry is in the ledger.`);
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
    <Sheet
      title={item ? 'Edit monthly item' : 'New monthly item'}
      dialogRef={(el) => {
        dialog = el;
      }}
      onClose={() => {
        editing.value = null;
      }}
    >
      <form onSubmit={save} noValidate>
        <div class="form-row">
          <label for="ri-name">Name</label>
          <div class="control">
            <input
              ref={(el) => {
                nameInput = el;
              }}
              id="ri-name"
              class="field-input"
              type="text"
              autoComplete="off"
              autoCapitalize="sentences"
              maxLength={80}
              placeholder="Gym, rent, savings…"
              value={nameText.value}
              aria-invalid={err.name ? 'true' : undefined}
              aria-describedby={err.name ? 'ri-name-err' : undefined}
              onInput={(e) => (nameText.value = e.currentTarget.value)}
            />
            {err.name && (
              <p class="field-error" id="ri-name-err">
                {err.name}
              </p>
            )}
          </div>
        </div>

        <div class="form-row">
          <label for="ri-amount">Amount</label>
          <div class="control">
            <input
              ref={(el) => {
                amountInput = el;
              }}
              id="ri-amount"
              class="field-input amount-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.000"
              value={amountText.value}
              aria-invalid={err.amount ? 'true' : undefined}
              aria-describedby={err.amount ? 'ri-amount-err' : undefined}
              onInput={(e) => (amountText.value = e.currentTarget.value)}
            />
            <span class="suffix" aria-hidden="true">
              BD
            </span>
            {err.amount && (
              <p class="field-error" id="ri-amount-err">
                {err.amount}
              </p>
            )}
          </div>
        </div>

        <div class="form-row">
          <label for="ri-day">Day</label>
          <div class="control">
            <input
              ref={(el) => {
                dayInput = el;
              }}
              id="ri-day"
              class="field-input day-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              autoComplete="off"
              value={dayText.value}
              aria-invalid={err.day ? 'true' : undefined}
              aria-describedby="ri-day-hint"
              onInput={(e) => (dayText.value = e.currentTarget.value)}
            />
            <p class={err.day ? 'field-error' : 'hint'} id="ri-day-hint">
              {err.day ?? 'Day of the month. 29–31 fall on the last day of shorter months.'}
            </p>
          </div>
        </div>

        <div class="form-row">
          <span class="label">As</span>
          <div class="control">
            <div class="toggle" role="group" aria-label="Type">
              <button type="button" class="is-fixed" aria-pressed={type.value === 'fixed'} onClick={() => (type.value = 'fixed')}>
                Fixed
              </button>
              <button type="button" class="is-savings" aria-pressed={type.value === 'savings'} onClick={() => (type.value = 'savings')}>
                Savings
              </button>
            </div>
          </div>
        </div>

        {item && <p class="hint">Changes apply to entries written from now on. Entries already in the ledger stay as they are.</p>}

        <div class="card-actions">
          {item ? (
            <button type="button" class={`ink-btn danger${confirmingDelete.value ? ' solid' : ''}`} onClick={remove}>
              <Icon name="trash" />
              {confirmingDelete.value ? 'Tap again to delete' : 'Delete'}
            </button>
          ) : (
            <span class="spacer" />
          )}
          <button type="submit" class="ink-btn primary" disabled={busy.value}>
            <Icon name="check" />
            {item ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
