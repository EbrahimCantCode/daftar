import { signal } from '@preact/signals';
import { dayLabel } from '../../../domain/dates';
import { ENTRY_TYPES } from '../../../domain/entryTypes';
import { byDateThenCreated } from '../../../domain/markdown';
import { formatFils } from '../../../domain/money';
import type { Slice } from '../../../domain/slices';
import { BottomSheet } from '../../components/BottomSheet';
import { EntryRow } from '../../components/EntryRow';
import { Hint } from '../../components/Form';
import { openQuickAdd } from '../Ledger/QuickAddSheet';

const shown = signal<{ slice: Slice; color: string } | null>(null);
let dialog: HTMLDialogElement | null = null;

/** Lists the entries behind a slice of the chart. */
export function openSlice(slice: Slice, color: string) {
  shown.value = { slice, color };
  if (dialog && !dialog.open) dialog.showModal();
}

export function SliceSheet() {
  const s = shown.value;
  const list = s ? [...s.slice.entries].sort(byDateThenCreated).reverse() : [];
  return (
    <BottomSheet
      title={s?.slice.label ?? ''}
      dialogRef={(el) => {
        dialog = el;
      }}
      onClose={() => {}}
    >
      {s && (
        <>
          <Hint>
            {s.slice.count} {s.slice.count === 1 ? 'entry' : 'entries'}, {formatFils(s.slice.totalFils)}
          </Hint>
          <ul class="slice-list" style={{ '--legend-ink': s.color }}>
            {list.map((e) => (
              <li key={e.id}>
                <EntryRow
                  type={e.type}
                  amountFils={e.amountFils}
                  srText={`(${ENTRY_TYPES[e.type].srLabel}, ${dayLabel(e.date)})`}
                  leading={<span class="slice-date">{dayLabel(e.date).replace(/^\w+ /, '')}</span>}
                  onClick={() => {
                    dialog?.close();
                    openQuickAdd(e);
                  }}
                >
                  {e.description}
                </EntryRow>
              </li>
            ))}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}
