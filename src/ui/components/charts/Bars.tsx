import { niceScale } from '../../../domain/insights';
import { SketchLine, SketchRect } from './sketch';

export interface BarSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

interface BarsProps {
  labels: string[];
  series: BarSeries[];
  width: number;
  height?: number;
  /** Axis label for a value (e.g. whole dinars, or "12%"). */
  axis: (v: number) => string;
  /** An extra mark per category, drawn as a short pen stroke (e.g. net saved). */
  marks?: { name: string; color: string; values: (number | null)[] };
  selected: number | null;
  onSelect: (index: number) => void;
  /** Accessible name for a category's tap target. */
  describe: (index: number) => string;
}

const PAD = { left: 40, right: 6, top: 10, bottom: 26 };

/** Grouped, hand-hatched bars with a zero line, light gridlines and tap-to-read columns. Handles negatives. */
export function Bars({ labels, series, width, height = 200, axis, marks, selected, onSelect, describe }: BarsProps) {
  const all = [...series.flatMap((s) => s.values), ...(marks?.values ?? [])].filter((v): v is number => v !== null);
  const pos = niceScale(Math.max(0, ...all));
  const negMax = Math.max(0, ...all.map((v) => -v));
  const neg = negMax > 0 ? niceScale(negMax) : { max: 0, ticks: [0] };
  const hi = pos.max;
  const lo = -neg.max;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH;
  const n = labels.length;
  const group = plotW / Math.max(1, n);
  const barW = Math.min(28, (group * 0.72) / Math.max(1, series.length));
  const labelEvery = n > 8 ? Math.ceil(n / 6) : 1;
  const ticks = [...neg.ticks.filter((t) => t > 0).map((t) => -t), ...pos.ticks];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} class={t === 0 ? 'chart-zero' : 'chart-grid'} />
          <text x={PAD.left - 6} y={y(t) + 4} text-anchor="end" class="chart-axis">
            {axis(t)}
          </text>
        </g>
      ))}
      {labels.map((label, i) => {
        const gx = PAD.left + i * group;
        return (
          <g key={i}>
            {selected === i && <rect x={gx + 1} y={PAD.top} width={group - 2} height={plotH} class="chart-selected" />}
            {series.map((s, j) => {
              const v = s.values[i];
              if (v === null || v === undefined || v === 0) return null;
              const x = gx + (group - barW * series.length) / 2 + j * barW;
              const top = Math.min(y(v), y(0));
              return <SketchRect key={s.name} x={x + 1} y={top} w={barW - 2} h={Math.abs(y(v) - y(0))} color={s.color} seed={i * 7 + j + 1} />;
            })}
            {marks && marks.values[i] !== null && marks.values[i] !== undefined && (
              <SketchLine
                points={[
                  [gx + group * 0.12, y(marks.values[i]!)],
                  [gx + group * 0.88, y(marks.values[i]!)],
                ]}
                color={marks.color}
                seed={i + 300}
                width={3}
              />
            )}
            {i % labelEvery === 0 && (
              <text x={gx + group / 2} y={height - 8} text-anchor="middle" class="chart-axis">
                {label}
              </text>
            )}
            <rect
              x={gx}
              y={PAD.top}
              width={group}
              height={plotH}
              class="chart-hit"
              role="button"
              tabIndex={0}
              aria-label={describe(i)}
              aria-pressed={selected === i}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(i);
                }
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
