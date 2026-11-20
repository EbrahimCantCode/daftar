import { LedgerPage } from './ui/pages/Ledger/LedgerPage';
import { MonthlyPage } from './ui/pages/Monthly/MonthlyPage';
import { ReportPage } from './ui/pages/Report/ReportPage';
import { SettingsPage } from './ui/pages/Settings/SettingsPage';
import { Toast } from './ui/components/Toast';
import { route } from './state/router';
import { loadError, ready } from './state/store';

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
  return (
    <>
      <main class="notebook">
        {route.value === 'monthly' ? (
          <MonthlyPage />
        ) : route.value === 'settings' ? (
          <SettingsPage />
        ) : route.value === 'report' ? (
          <ReportPage />
        ) : (
          <LedgerPage />
        )}
      </main>
      <Toast />
    </>
  );
}
