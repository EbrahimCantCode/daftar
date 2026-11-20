import { href } from '../../../state/router';
import { LinkRow } from '../../components/LinkRow';
import { TopBar } from '../../components/TopBar';

export function MorePage() {
  return (
    <div class="screen">
      <TopBar title="More" />
      <nav class="section" aria-label="More">
        <LinkRow href={href('monthly')} icon="repeat" hint="each cycle">
          Monthly items
        </LinkRow>
        <LinkRow href={href('reports')} icon="report" hint="cycle & year">
          Reports
        </LinkRow>
        <LinkRow href={href('settings')} icon="gear">
          Settings
        </LinkRow>
      </nav>
    </div>
  );
}
