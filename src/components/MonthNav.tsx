import { addMonths, monthLabel } from '../lib/dates';
import { Icon } from './Icon';

interface Props {
  month: string;
  current: string;
  onGo: (month: string) => void;
}

/** Notebook divider tabs for the previous, current and next month, plus arrows. */
export function MonthNav({ month, current, onGo }: Props) {
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const tabLabel = (m: string) =>
    m.slice(0, 4) === month.slice(0, 4) ? monthLabel(m, { short: true }) : `${monthLabel(m, { short: true })} ’${m.slice(2, 4)}`;

  return (
    <>
      <nav class="month-nav" aria-label="Months">
        <button type="button" class="icon-btn" aria-label={`Previous month (${monthLabel(prev)})`} onClick={() => onGo(prev)}>
          <Icon name="prev" />
        </button>
        <div class="month-tabs">
          {[prev, month, next].map((m) => (
            <button
              key={m}
              type="button"
              class="month-tab"
              aria-current={m === month ? 'date' : undefined}
              aria-label={monthLabel(m)}
              onClick={() => m !== month && onGo(m)}
            >
              {tabLabel(m)}
            </button>
          ))}
        </div>
        <button type="button" class="icon-btn" aria-label={`Next month (${monthLabel(next)})`} onClick={() => onGo(next)}>
          <Icon name="next" />
        </button>
      </nav>
      <h2 class="month-title" aria-live="polite">
        <span>{monthLabel(month, { short: false }).split(' ')[0]}</span>
        <span class="year">{month.slice(0, 4)}</span>
        {month !== current && (
          <a
            class="today-link"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onGo(current);
            }}
          >
            Back to this month
          </a>
        )}
      </h2>
    </>
  );
}
