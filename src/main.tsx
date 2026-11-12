import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/courier-prime/latin-400-italic.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/ledger.css';
import './styles/pages.css';
import './styles/report.css';

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
