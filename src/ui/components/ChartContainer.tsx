import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface ChartContainerProps {
  title: string;
  /** One sentence describing what the chart shows, for screen readers. */
  summary: string;
  /** When set, shown instead of the chart (not enough data yet). */
  empty?: string | null;
  /** The same data as a table, read out by screen readers instead of the drawing. */
  table: { head: string[]; rows: string[][] };
  /** Draws the chart at the measured width in CSS pixels. */
  children: (width: number) => ComponentChildren;
  /** Text under the chart (a tapped value, a projection…). */
  note?: ComponentChildren;
}

/** Every chart's frame: title, sizing, empty state, a caption line and an accessible data table. */
export function ChartContainer({ title, summary, empty, table, children, note }: ChartContainerProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty]);

  return (
    <figure class="chart">
      <figcaption class="section-title">{title}</figcaption>
      {empty ? (
        <p class="chart-empty">{empty}</p>
      ) : (
        <>
          <div class="chart-box" ref={box} role="img" aria-label={summary}>
            {width > 0 && children(width)}
          </div>
          {note && <p class="chart-note">{note}</p>}
          <table class="visually-hidden">
            <caption>{title}</caption>
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
