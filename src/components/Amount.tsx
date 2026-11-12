import { formatFils } from '../lib/money';

/** A money amount in typewriter digits, which are fixed-width so columns line up like a ledger. */
export function Amount({ fils, unit = true, class: cls = '' }: { fils: number; unit?: boolean; class?: string }) {
  return (
    <span class={`amount ${cls}`}>
      {formatFils(fils, { unit: false })}
      {unit && <span class="unit">BD</span>}
    </span>
  );
}
