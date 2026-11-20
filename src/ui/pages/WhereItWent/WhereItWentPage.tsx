import { EmptyState } from '../../components/EmptyState';
import { TopBar } from '../../components/TopBar';

export function WhereItWentPage() {
  return (
    <div class="screen">
      <TopBar title="Where it went" />
      <EmptyState title="Coming soon." />
    </div>
  );
}
