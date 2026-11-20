import { EmptyState } from '../../components/EmptyState';
import { TopBar } from '../../components/TopBar';

export function InsightsPage() {
  return (
    <div class="screen">
      <TopBar title="Insights" />
      <EmptyState title="Coming soon." />
    </div>
  );
}
