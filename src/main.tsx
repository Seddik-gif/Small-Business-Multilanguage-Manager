import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
// Fonts ship with the app (no Google Fonts): the till must look right with no network, and cheap
// Android tablets often lack Bengali or Arabic system fonts. Each file loads only when its script appears.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/noto-sans-arabic/wght.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';
import '@fontsource-variable/noto-sans-sc/wght.css';
import './index.css';
import './i18n';
import { router } from './app/router';
import { startSync } from './sync/engine';
import { initAuth } from './stores/auth';

registerSW({ immediate: true });
initAuth(); // links the device to the account on sign-in; sync stays gated until that completes
startSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
