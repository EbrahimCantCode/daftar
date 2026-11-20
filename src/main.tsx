import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/courier-prime/latin-400-italic.css';
import './ui/styles.css';

import { render } from 'preact';
import { App } from './app';
import { init } from './state/store';
import { initFavicon } from './favicon';
import { initPwa } from './pwa';
import { initTheme } from './theme';

initTheme();
initFavicon();
render(<App />, document.getElementById('app')!);
void init();
initPwa();
