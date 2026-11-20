import { dayLabel } from '../../../domain/dates';
import { ENTRY_TYPES } from '../../../domain/entryTypes';
import type { DayGroup } from '../../../domain/totals';
import type { Entry } from '../../../domain/types';
import { Amount } from '../../components/Amount';
import { EntryRow } from '../../components/EntryRow';
import { Icon } from '../../components/Icon';

/** A cycle's entries, one ruled block per day, newest day first. */
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
                <EntryRow
                  type={e.type}
                  amountFils={e.amountFils}
                  onClick={() => onEdit(e)}
                  srText={`(${ENTRY_TYPES[e.type].srLabel}${e.recurringId ? ', monthly' : ''}${e.salary ? ', salary' : ''})`}
                  tag={
                    (e.recurringId || e.salary) && (
                      <span class="entry-tag" aria-hidden="true">
                        <Icon name={e.salary ? 'wallet' : 'repeat'} />
                      </span>
                    )
                  }
                >
                  {e.description}
                </EntryRow>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
