import { addMonths, monthLabel } from '../../domain/dates';
import { cycleRange, type Cycle } from '../../domain/cycles';
import { IconButton } from './IconButton';

interface CycleSelectorProps {
  cycle: Cycle;
  /** Key of the cycle that contains today. */
  currentKey: string;
  onGo: (key: string) => void;
}

/**
 * Notebook divider tabs for the previous, shown and next pay cycle, with arrows,
 * then the cycle's name and its date range.
 */
export function CycleSelector({ cycle, currentKey, onGo }: CycleSelectorProps) {
  const key = cycle.key;
  const prev = addMonths(key, -1);
  const next = addMonths(key, 1);
  const sameYear = (k: string) => k.slice(0, 4) === key.slice(0, 4);
  const tabLabel = (k: string) => (sameYear(k) ? monthLabel(k, { short: true }) : `${monthLabel(k, { short: true })} ’${k.slice(2, 4)}`);

  return (
    <>
      <nav class="month-nav" aria-label="Pay cycles">
        <IconButton icon="prev" label={`Previous cycle (${monthLabel(prev)})`} onClick={() => onGo(prev)} />
        <div class="month-tabs">
          {[prev, key, next].map((k) => (
            <button
              key={k}
              type="button"
              class="month-tab"
              aria-current={k === key ? 'date' : undefined}
              title={monthLabel(k)}
              onClick={() => k !== key && onGo(k)}
            >
              {tabLabel(k)}
              {sameYear(k) && <span class="visually-hidden"> {k.slice(0, 4)}</span>}
            </button>
          ))}
        </div>
        <IconButton icon="next" label={`Next cycle (${monthLabel(next)})`} onClick={() => onGo(next)} />
      </nav>
      <h2 class="month-title" aria-live="polite">
        <span>{monthLabel(key).split(' ')[0]}</span>
        <span class="year">{key.slice(0, 4)}</span>
      </h2>
      <p class="cycle-range">
        <span>{cycleRange(cycle)}</span>
        {key !== currentKey && (
          <a
            class="today-link"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onGo(currentKey);
            }}
          >
            Back to this cycle
          </a>
        )}
      </p>
    </>
  );
}
