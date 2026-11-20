import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';

// Hand-inked marks for charts. Rough.js works out the wobbly strokes and hatching;
// we render its paths as Preact elements, styled with CSS variables (SVG presentation
// attributes can't use var(), the style property can). A fixed seed per mark keeps
// the drawing still between renders.

const gen = rough.generator();

const BASE: Options = { roughness: 1.1, bowing: 0.8, strokeWidth: 1.6, fillWeight: 1.4, hachureGap: 5, preserveVertices: true };

function toElements(drawable: ReturnType<typeof gen.arc>, key: string) {
  return gen.toPaths(drawable).map((p, i) => (
    <path
      key={`${key}-${i}`}
      d={p.d}
      style={{ stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill ?? 'none' }}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  ));
}

/** A hatched pie wedge from `start` to `end` (radians, clockwise from 3 o'clock as in SVG). */
export function SketchArc({ cx, cy, r, start, end, color, seed }: { cx: number; cy: number; r: number; start: number; end: number; color: string; seed: number }) {
  if (end - start <= 0) return null;
  const d = gen.arc(cx, cy, r * 2, r * 2, start, end, true, { ...BASE, seed, stroke: color, fill: color, fillStyle: 'hachure', hachureAngle: -41 + seed * 17 });
  return <g>{toElements(d, `arc${seed}`)}</g>;
}

/** A hatched bar. */
export function SketchRect({ x, y, w, h, color, seed, fillStyle = 'hachure' }: { x: number; y: number; w: number; h: number; color: string; seed: number; fillStyle?: string }) {
  if (w <= 0 || h <= 0) return null;
  const d = gen.rectangle(x, y, w, h, { ...BASE, seed, stroke: color, fill: color, fillStyle, hachureGap: 4 });
  return <g>{toElements(d, `rect${seed}`)}</g>;
}

/** A pen line through points. */
export function SketchLine({ points, color, seed, width = 2 }: { points: [number, number][]; color: string; seed: number; width?: number }) {
  if (points.length < 2) return null;
  const d = gen.linearPath(points, { ...BASE, seed, stroke: color, strokeWidth: width, roughness: 0.7 });
  return <g>{toElements(d, `line${seed}`)}</g>;
}

/** A plain circle (dots, the donut hole). */
export function SketchCircle({ cx, cy, d: diameter, color, fill, seed }: { cx: number; cy: number; d: number; color: string; fill?: string; seed: number }) {
  const d = gen.circle(cx, cy, diameter, { ...BASE, seed, stroke: color, fill, fillStyle: 'solid', roughness: 0.6 });
  return <g>{toElements(d, `circle${seed}`)}</g>;
}

/** Colours for categories, in order; the last is used for "Other". */
export const CHART_INKS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7'].map((t) => `var(${t})`);
export const OTHER_INK = 'var(--chart-other)';
