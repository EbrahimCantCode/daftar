import type { JSX } from 'preact';
import { route, type Route } from './state/router';
import { loadError, migrationNeeded, ready } from './state/store';
import { TabBar } from './ui/components/TabBar';
import { Toast } from './ui/components/Toast';
import { InsightsPage } from './ui/pages/Insights/InsightsPage';
import { LedgerPage } from './ui/pages/Ledger/LedgerPage';
import { MigrationPage } from './ui/pages/Migration/MigrationPage';
import { MonthlyPage } from './ui/pages/Monthly/MonthlyPage';
import { MorePage } from './ui/pages/More/MorePage';
import { ReportPage } from './ui/pages/Report/ReportPage';
import { ReportsPage } from './ui/pages/Reports/ReportsPage';
import { YearReportPage } from './ui/pages/Report/YearReportPage';
import { SettingsPage } from './ui/pages/Settings/SettingsPage';
import { WhereItWentPage } from './ui/pages/WhereItWent/WhereItWentPage';

const PAGES: Record<Route, () => JSX.Element> = {
  ledger: LedgerPage,
  where: WhereItWentPage,
  insights: InsightsPage,
  more: MorePage,
  monthly: MonthlyPage,
  settings: SettingsPage,
  reports: ReportsPage,
  report: ReportPage,
  year: YearReportPage,
};

export function App() {
  if (loadError.value) {
    return (
      <main class="notebook">
        <p class="boot" role="alert">
          {loadError.value}
        </p>
      </main>
    );
  }
  if (!ready.value) {
    return (
      <main class="notebook" aria-busy="true">
        <p class="boot">Opening your daftar…</p>
      </main>
    );
  }
  if (migrationNeeded.value) {
    return (
      <>
        <main class="notebook">
          <MigrationPage />
        </main>
        <Toast />
      </>
    );
  }
  const Page = PAGES[route.value];
  return (
    <>
      <main class="notebook">
        <Page />
      </main>
      <TabBar route={route.value} />
      <Toast />
    </>
  );
}
