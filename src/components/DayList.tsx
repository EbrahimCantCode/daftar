import { dayLabel } from '../lib/dates';
import type { DayGroup } from '../lib/totals';
import type { Entry } from '../types';
import { Amount } from './Amount';
import { Icon } from './Icon';

const TYPE_NAME: Record<Entry['type'], string> = { spend: 'spend', fixed: 'fixed', savings: 'savings' };

export function DayList({ groups, onEdit }: { groups: DayGroup[]; onEdit: (entry: Entry) => void }) {
  return (
    <section aria-label="Entries">
      {groups.map((g) => (
        <section class="day" key={g.date} aria-labelledby={`day-${g.date}`}>
          <h3 class="day-head" id={`day-${g.date}`}>
            <span>{dayLabel(g.date)}</span>
            {g.entries.length > 1 && <Amount fils={g.totalFils} unit={false} />}
          </h3>
          <ul>
            {g.entries.map((e) => (
              <li key={e.id}>
                <button type="button" class={`entry type-${e.type}`} onClick={() => onEdit(e)}>
                  <span class="entry-desc">{e.description}</span>
                  <span class="visually-hidden">
                    ({TYPE_NAME[e.type]}
                    {e.recurringId ? ', monthly' : ''})
                  </span>
                  {e.recurringId && (
                    <span class="entry-tag" aria-hidden="true">
                      <Icon name="repeat" />
                    </span>
                  )}
                  <Amount fils={e.amountFils} unit={false} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
