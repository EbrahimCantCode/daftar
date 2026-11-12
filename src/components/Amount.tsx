import { formatFils } from '../lib/money';

/**
 * A money amount in handwriting. Every digit gets the same width so columns of
 * amounts line up like a ledger even though the handwritten font is proportional.
 */
export function Amount({ fils, unit = true, class: cls = '' }: { fils: number; unit?: boolean; class?: string }) {
  const text = formatFils(fils, { unit: false });
  return (
    <span class={`amount ${cls}`}>
      <span class="visually-hidden">{formatFils(fils)}</span>
      <span aria-hidden="true">
        {[...text].map((ch, i) => (
          <span key={i} class={/\d/.test(ch) ? 'd' : ch === '−' ? 's' : 'p'}>
            {ch}
          </span>
        ))}
        {unit && <span class="unit">BD</span>}
      </span>
    </span>
  );
}
