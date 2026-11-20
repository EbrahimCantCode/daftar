import type { ComponentChildren } from 'preact';
import { sliceAngles, type Slice } from '../../../domain/slices';
import { SketchArc, SketchCircle } from './sketch';

interface DonutProps {
  slices: Slice[];
  colors: string[];
  size: number;
  selectedKey: string | null;
  onSelect: (slice: Slice) => void;
  /** Shown in the hole. */
  center: ComponentChildren;
  /** Accessible name for each wedge, e.g. "Coffee, 12.000 BD, 14%". */
  describe: (slice: Slice) => string;
}

const point = (cx: number, cy: number, r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;

/** An annular sector path, used as a clean tap target over the sketchy wedge. */
function sectorPath(cx: number, cy: number, outer: number, inner: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    const mid = a0 + Math.PI;
    return [
      `M ${point(cx, cy, outer, a0)} A ${outer} ${outer} 0 1 1 ${point(cx, cy, outer, mid)} A ${outer} ${outer} 0 1 1 ${point(cx, cy, outer, a0)}`,
      `M ${point(cx, cy, inner, a0)} A ${inner} ${inner} 0 1 0 ${point(cx, cy, inner, mid)} A ${inner} ${inner} 0 1 0 ${point(cx, cy, inner, a0)} Z`,
    ].join(' ');
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${point(cx, cy, outer, a0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${point(cx, cy, outer, a1)}`,
    `L ${point(cx, cy, inner, a1)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${point(cx, cy, inner, a0)}`,
    'Z',
  ].join(' ');
}

/** A hand-hatched donut. Tapping a wedge (or Enter on it) selects it; the selected wedge lifts out a little. */
export function Donut({ slices, colors, size, selectedKey, onSelect, center, describe }: DonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 10;
  const inner = outer * 0.56;
  const angles = sliceAngles(slices);

  return (
    <div class="donut" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {slices.map((s, i) => {
          const { start, end } = angles[i]!;
          const lift = s.key === selectedKey ? 7 : 0;
          const mid = (start + end) / 2;
          return (
            <g key={s.key} transform={`translate(${(Math.cos(mid) * lift).toFixed(2)} ${(Math.sin(mid) * lift).toFixed(2)})`}>
              <SketchArc cx={cx} cy={cy} r={outer} start={start} end={end} color={colors[i]!} seed={i + 1} />
            </g>
          );
        })}
        <SketchCircle cx={cx} cy={cy} d={inner * 2} color="var(--ink-soft)" fill="var(--paper)" seed={99} />
      </svg>
      <svg class="donut-hits" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={s.key}
            class="chart-hit"
            d={sectorPath(cx, cy, outer + 6, inner, angles[i]!.start, angles[i]!.end)}
            role="button"
            tabIndex={0}
            aria-label={describe(s)}
            aria-pressed={s.key === selectedKey}
            onClick={() => onSelect(s)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(s);
              }
            }}
          />
        ))}
      </svg>
      <div class="donut-center">{center}</div>
    </div>
  );
}
