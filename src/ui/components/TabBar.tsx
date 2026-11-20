import { TABS, href, tabOf, type Route, type Tab } from '../../state/router';
import { Icon, type IconName } from './Icon';

const TAB_INFO: Record<Tab, { label: string; icon: IconName }> = {
  ledger: { label: 'Ledger', icon: 'book' },
  where: { label: 'Where it went', icon: 'pie' },
  insights: { label: 'Insights', icon: 'chart' },
  more: { label: 'More', icon: 'menu' },
};

/** The bottom tabs, drawn as notebook dividers sticking up from the page's bottom edge. */
export function TabBar({ route }: { route: Route }) {
  const active = tabOf(route);
  return (
    <nav class="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <a key={t} class="tabbar-tab" href={href(t)} aria-current={t === active ? 'page' : undefined}>
          <Icon name={TAB_INFO[t].icon} />
          <span>{TAB_INFO[t].label}</span>
        </a>
      ))}
    </nav>
  );
}
