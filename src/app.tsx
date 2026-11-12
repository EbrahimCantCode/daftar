import { LedgerPage } from './pages/LedgerPage';
import { MonthlyPage } from './pages/MonthlyPage';
import { SettingsPage } from './pages/SettingsPage';
import { Toast } from './components/Toast';
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
        {route.value === 'monthly' ? <MonthlyPage /> : route.value === 'settings' ? <SettingsPage /> : <LedgerPage />}
      </main>
      <Toast />
    </>
  );
}
