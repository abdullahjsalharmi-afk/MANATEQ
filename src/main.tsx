import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/fonts.css';
import './design/tokens.css';
import './design/base.css';
import { App } from './App';
import { setupPwa } from './app/pwa';
import { applyAppearance } from './app/theme';
import { applyBootParams } from './state/boot';
import { getState } from './state/store';

// Demo links: ?demo=tenant&lang=en&theme=dark opens the app in a given state.
applyBootParams(window.location.search);
// Set language, direction and theme before the first paint.
applyAppearance(getState().settings);

setupPwa();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
