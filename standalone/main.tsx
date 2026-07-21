// standalone/main.tsx
//
// Vite entry point for the REAL production standalone build (as opposed to
// dev/main.tsx, which renders the mock-services DevApp for local component
// development only — see that file's own doc comment). This is the file a
// deployed GitHub Pages build actually boots.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { StandaloneApp } from '../src/app/standalone/StandaloneApp.js';

const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>,
);
