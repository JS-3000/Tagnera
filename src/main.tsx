import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ensureDemoData } from './services/demoData';
import './styles.css';

// Service worker: makes the app installable and usable offline. Updates install automatically.
registerSW({ immediate: true });

// Load / refresh the fixed demo data before the first screen, so a scanned
// demo QR code shows the right component immediately (no click, no import).
ensureDemoData()
  .catch((e) => console.error('Demo-Daten konnten nicht geladen werden', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
