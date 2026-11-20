import { Icon, type IconName } from './Icon';

/**
 * The floating pen. `heat` (0–1) shifts its ink from blue toward red, following
 * today's spending against the daily goal.
 */
export function Fab({ icon, label, title, heat = 0, onClick }: { icon: IconName; label: string; title?: string; heat?: number; onClick: () => void }) {
  return (
    <button type="button" class="fab" style={{ '--heat': `${Math.round(heat * 100)}%` }} aria-label={label} title={title} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}
