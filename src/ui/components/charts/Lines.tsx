import { niceScale } from '../../../domain/insights';
import { SketchCircle, SketchLine } from './sketch';

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
  /** 'dash' and 'dot' draw comparison lines; the main line is solid. */
  style?: 'solid' | 'dash' | 'dot';
}

interface LinesProps {
  /** One label per x position; empty strings are skipped on the axis. */
  labels: string[];
  series: LineSeries[];
  width: number;
  height?: number;
  axis: (v: number) => string;
  selected: number | null;
  onSelect: (index: number) => void;
  describe: (index: number) => string;
  /** Show a dot on each point (for few points, e.g. cycles). */
  dots?: boolean;
}

const PAD = { left: 40, right: 10, top: 10, bottom: 26 };
const DASH: Record<string, string | undefined> = { dash: '7 6', dot: '2 6', solid: undefined };

/** Pen-drawn lines with a zero line, gridlines and tap-to-read columns. Gaps (null) break a line. */
export function Lines({ labels, series, width, height = 200, axis, selected, onSelect, describe, dots = false }: LinesProps) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const pos = niceScale(Math.max(0, ...all));
  const negMax = Math.max(0, ...all.map((v) => -v));
  const neg = negMax > 0 ? niceScale(negMax) : { max: 0, ticks: [0] };
  const hi = pos.max;
  const lo = -neg.max;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * plotH;
  const step = n <= 1 ? plotW : plotW / (n - 1);
  const ticks = [...neg.ticks.filter((t) => t > 0).map((t) => -t), ...pos.ticks];

  const segments = (values: (number | null)[]) => {
    const out: [number, number][][] = [];
    let run: [number, number][] = [];
    values.forEach((v, i) => {
      if (v === null) {
        if (run.length) out.push(run);
        run = [];
      } else run.push([x(i), y(v)]);
    });
    if (run.length) out.push(run);
    return out;
  };

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
      {selected !== null && <line x1={x(selected)} x2={x(selected)} y1={PAD.top} y2={PAD.top + plotH} class="chart-cursor" />}
      {series.map((s, si) => (
        <g key={s.name} style={{ strokeDasharray: DASH[s.style ?? 'solid'] }}>
          {segments(s.values).map((pts, k) =>
            pts.length === 1 ? (
              <SketchCircle key={k} cx={pts[0]![0]} cy={pts[0]![1]} d={7} color={s.color} fill={s.color} seed={si * 50 + k} />
            ) : (
              <SketchLine key={k} points={pts} color={s.color} seed={si * 50 + k + 1} width={s.style && s.style !== 'solid' ? 1.8 : 2.6} />
            ),
          )}
          {dots &&
            s.values.map((v, i) =>
              v === null ? null : <SketchCircle key={`d${i}`} cx={x(i)} cy={y(v)} d={7} color={s.color} fill={s.color} seed={si * 50 + i + 20} />,
            )}
        </g>
      ))}
      {labels.map((label, i) =>
        label ? (
          <text key={`l${i}`} x={x(i)} y={height - 8} text-anchor="middle" class="chart-axis">
            {label}
          </text>
        ) : null,
      )}
      {labels.map((_, i) => (
        <rect
          key={`h${i}`}
          x={x(i) - step / 2}
          y={PAD.top}
          width={step}
          height={plotH}
          class="chart-hit"
          role="button"
          tabIndex={n > 12 ? -1 : 0}
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
      ))}
    </svg>
  );
}
