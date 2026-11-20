import { ordinal } from '../../../domain/dates';
import { inkVar } from '../../../domain/entryTypes';
import type { RecurringItem, RecurringTiming, RecurringType } from '../../../domain/types';
import { recurringSorted, setRecurringActive } from '../../../state/store';
import { Amount } from '../../components/Amount';
import { Button } from '../../components/Button';
import { Chip, Chips } from '../../components/Chips';
import { EmptyState } from '../../components/EmptyState';
import { EntryRow } from '../../components/EntryRow';
import { IconButton } from '../../components/IconButton';
import { showToast } from '../../components/Toast';
import { TopBar } from '../../components/TopBar';
import { RecurringSheet, openRecurring } from './RecurringSheet';

const EXAMPLES: { name: string; type: RecurringType; timing?: RecurringTiming }[] = [
  { name: 'Savings', type: 'savings', timing: 'payday' },
  { name: 'Gym', type: 'fixed' },
  { name: 'Claude subscription', type: 'fixed' },
];

const when = (item: RecurringItem) => (item.timing === 'payday' ? 'payday' : ordinal(item.dayOfMonth));
const whenSr = (item: RecurringItem) => (item.timing === 'payday' ? 'on payday' : `on the ${ordinal(item.dayOfMonth)}`);

export function MonthlyPage() {
  const items = recurringSorted.value;
  const active = items.filter((i) => i.active);
  const fixedFils = active.filter((i) => i.type === 'fixed').reduce((s, i) => s + i.amountFils, 0);
  const savingsFils = active.filter((i) => i.type === 'savings').reduce((s, i) => s + i.amountFils, 0);

  return (
    <div class="screen">
      <TopBar title="Monthly" back />
      <p class="page-intro">Written into the ledger automatically once every pay cycle: on payday, or on their day of the month.</p>

      {items.length === 0 ? (
        <EmptyState title="No monthly items yet.">
          <p>Start with one of these:</p>
          <Chips wrap>
            {EXAMPLES.map((ex) => (
              <Chip key={ex.name} onClick={() => openRecurring(undefined, ex)}>
                {ex.name}
              </Chip>
            ))}
          </Chips>
        </EmptyState>
      ) : (
        <>
          <ul class="rec-list section">
            {items.map((item) => (
              <li key={item.id} class={`rec-row${item.active ? '' : ' is-paused'}`}>
                <EntryRow
                  type={item.type}
                  amountFils={item.amountFils}
                  muted={!item.active}
                  onClick={() => openRecurring(item)}
                  leading={<span class="rec-day">{when(item)}</span>}
                  srText={`, ${item.type}, ${whenSr(item)}${item.active ? '' : ', paused'}`}
                  tag={
                    !item.active && (
                      <span class="paused-tag" aria-hidden="true">
                        paused
                      </span>
                    )
                  }
                >
                  {item.name}
                </EntryRow>
                <IconButton
                  icon={item.active ? 'pause' : 'play'}
                  label={item.active ? `Pause ${item.name}` : `Resume ${item.name}`}
                  onClick={async () => {
                    await setRecurringActive(item, !item.active);
                    showToast(item.active ? `Paused ${item.name}` : `Resumed ${item.name}`);
                  }}
                />
              </li>
            ))}
          </ul>
          <dl class="rec-totals">
            <div>
              <dt>Fixed each cycle</dt>
              <dd style={{ color: inkVar('fixed') }}>
                <Amount fils={fixedFils} />
              </dd>
            </div>
            <div>
              <dt>Saved each cycle</dt>
              <dd style={{ color: inkVar('savings') }}>
                <Amount fils={savingsFils} />
              </dd>
            </div>
          </dl>
        </>
      )}

      <div class="section">
        <Button icon="plus" onClick={() => openRecurring()}>
          Add monthly item
        </Button>
      </div>
      <RecurringSheet />
    </div>
  );
}
