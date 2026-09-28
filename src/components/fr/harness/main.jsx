/**
 * Entry for the DEV-ONLY FR harness page (fr-harness.html at the repo root).
 * Loads the same CSS as the app (tokens, fonts, FR look) but none of the app
 * modules — no Firebase, no auth. Vite builds only index.html for production,
 * so this entry never ships.
 */
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../index.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/onest';
import '../../../styles/fr-look.css';
import FrHarness from './FrHarness';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FrHarness />
  </StrictMode>,
);
