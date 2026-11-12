import { Amount } from '../components/Amount';
import { Icon } from '../components/Icon';
import { RecurringSheet, openRecurring } from '../components/RecurringSheet';
import { showToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { ordinal } from '../lib/dates';
import { recurringSorted, setRecurringActive } from '../state/store';
import type { RecurringType } from '../types';

const EXAMPLES: { name: string; type: RecurringType }[] = [
  { name: 'Savings', type: 'savings' },
  { name: 'Gym', type: 'fixed' },
  { name: 'Claude subscription', type: 'fixed' },
];

export function MonthlyPage() {
  const items = recurringSorted.value;
  const active = items.filter((i) => i.active);
  const fixedFils = active.filter((i) => i.type === 'fixed').reduce((s, i) => s + i.amountFils, 0);
  const savingsFils = active.filter((i) => i.type === 'savings').reduce((s, i) => s + i.amountFils, 0);

  return (
    <div class="screen">
      <TopBar title="Monthly" back />
      <p class="page-intro">Written into the ledger automatically every month, on their day.</p>

      {items.length === 0 ? (
        <div class="empty">
          <p class="hand">No monthly items yet.</p>
          <p>Start with one of these:</p>
          <div class="chips wrap">
            {EXAMPLES.map((ex) => (
              <button key={ex.name} type="button" class="chip" onClick={() => openRecurring(undefined, ex)}>
                {ex.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <ul class="rec-list section">
            {items.map((item) => (
              <li key={item.id} class={`rec-row${item.active ? '' : ' is-paused'}`}>
                <button type="button" class={`entry type-${item.type}`} onClick={() => openRecurring(item)}>
                  <span class="rec-day">{ordinal(item.dayOfMonth)}</span>
                  <span class="entry-desc">
                    {item.name}
                    <span class="visually-hidden">
                      , {item.type}, on the {ordinal(item.dayOfMonth)}
                      {item.active ? '' : ', paused'}
                    </span>
                  </span>
                  {!item.active && (
                    <span class="paused-tag" aria-hidden="true">
                      paused
                    </span>
                  )}
                  <Amount fils={item.amountFils} unit={false} />
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={item.active ? `Pause ${item.name}` : `Resume ${item.name}`}
                  title={item.active ? 'Pause' : 'Resume'}
                  onClick={async () => {
                    await setRecurringActive(item, !item.active);
                    showToast(item.active ? `Paused ${item.name}` : `Resumed ${item.name}`);
                  }}
                >
                  <Icon name={item.active ? 'pause' : 'play'} />
                </button>
              </li>
            ))}
          </ul>
          <dl class="rec-totals">
            <div>
              <dt>Fixed each month</dt>
              <dd class="ink-pencil">
                <Amount fils={fixedFils} />
              </dd>
            </div>
            <div>
              <dt>Saved each month</dt>
              <dd class="ink-green">
                <Amount fils={savingsFils} />
              </dd>
            </div>
          </dl>
        </>
      )}

      <div class="section">
        <button type="button" class="ink-btn" onClick={() => openRecurring()}>
          <Icon name="plus" />
          Add monthly item
        </button>
      </div>
      <RecurringSheet />
    </div>
  );
}
