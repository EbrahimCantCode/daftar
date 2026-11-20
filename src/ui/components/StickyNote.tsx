import type { ComponentChildren } from 'preact';

/** A taped-in sticky note, `lines` ruled lines tall so the page below stays on the rules. */
export function StickyNote({ label, lines = 4, children }: { label: string; lines?: number; children: ComponentChildren }) {
  return (
    <section class="sticky" style={{ '--note-lines': lines }} aria-label={label}>
      {children}
    </section>
  );
}

// Heights in rem from StickyNote.css, used to work out how many lines a note needs.
const ROW_REM = 1.75;
const TOTAL_ROW_REM = 2.85;
const PADDING_REM = 1.7;
const LINE_REM = 2.75;

/** Ruled lines needed for a summary note with `rows` plain rows and one total row. */
export function noteLines(rows: number): number {
  return Math.max(4, Math.ceil((rows * ROW_REM + TOTAL_ROW_REM + PADDING_REM) / LINE_REM));
}
