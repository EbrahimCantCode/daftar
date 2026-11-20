import { weekdayOf } from '../../../domain/insights';
import { SketchRect } from './sketch';

interface HeatmapProps {
  days: { date: string; fils: number }[];
  width: number;
  selected: string | null;
  onSelect: (date: string) => void;
  describe: (day: { date: string; fils: number }) => string;
  /** Days after this aren't over yet and are drawn faintly. */
  today: string;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A calendar of the cycle, one square per day, darker ink for more spending. Weeks run Monday to Sunday. */
export function Heatmap({ days, width, selected, onSelect, describe, today }: HeatmapProps) {
  if (!days.length) return null;
  const lead = weekdayOf(days[0]!.date);
  const weeks = Math.ceil((lead + days.length) / 7);
  const gap = 4;
  const size = Math.min(40, Math.floor((width - gap * 6) / 7));
  const top = 18;
  const height = top + weeks * (size + gap);
  const max = Math.max(1, ...days.map((d) => d.fils));

  return (
    <svg width={size * 7 + gap * 6} height={height} viewBox={`0 0 ${size * 7 + gap * 6} ${height}`} class="heatmap">
      {WEEKDAYS.map((w, i) => (
        <text key={i} x={i * (size + gap) + size / 2} y={12} text-anchor="middle" class="chart-axis">
          {w}
        </text>
      ))}
      {days.map((d, i) => {
        const cell = lead + i;
        const x = (cell % 7) * (size + gap);
        const y = top + Math.floor(cell / 7) * (size + gap);
        const future = d.date > today;
        const ink = d.fils > 0 ? Math.round(30 + (d.fils / max) * 60) : 0;
        return (
          <g key={d.date} class={future ? 'heat-future' : undefined}>
            {d.fils > 0 ? (
              <SketchRect
                x={x + 1}
                y={y + 1}
                w={size - 2}
                h={size - 2}
                color={`color-mix(in srgb, var(--ink-spend) ${ink}%, var(--paper-deep))`}
                seed={i + 1}
                fillStyle="solid"
              />
            ) : (
              <rect x={x + 1} y={y + 1} width={size - 2} height={size - 2} class="heat-empty" />
            )}
            <text x={x + 4} y={y + 12} class={`heat-day${ink > 55 ? ' on-dark' : ''}`}>
              {Number(d.date.slice(8))}
            </text>
            {selected === d.date && <rect x={x - 1} y={y - 1} width={size + 2} height={size + 2} class="heat-selected" />}
            <rect
              x={x}
              y={y}
              width={size}
              height={size}
              class="chart-hit"
              role="button"
              tabIndex={0}
              aria-label={describe(d)}
              aria-pressed={selected === d.date}
              onClick={() => onSelect(d.date)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(d.date);
                }
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
