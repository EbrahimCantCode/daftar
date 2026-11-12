import '@fontsource/caveat/latin-600.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/ledger.css';
import './styles/pages.css';

import { render } from 'preact';
import { App } from './app';
import { init } from './state/store';
import { initPwa } from './pwa';
import { initTheme } from './theme';

initTheme();
render(<App />, document.getElementById('app')!);
void init();
initPwa();
