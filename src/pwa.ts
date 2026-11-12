import { registerSW } from 'virtual:pwa-register';
import { showToast } from './components/Toast';

/** Registers the service worker and offers a reload when a new version has been cached. */
export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      showToast('A new version of Daftar is ready.', { actionLabel: 'Reload', action: () => updateSW(true), ms: 60_000 });
    },
    onOfflineReady() {
      showToast('Daftar now works offline.');
    },
  });
}
