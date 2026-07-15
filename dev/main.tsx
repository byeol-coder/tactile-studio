// dev/main.tsx
//
// Vite dev-server entry point for the development shell ONLY. This is NOT
// part of the reusable production package — a real host (Tactile World)
// never imports this file; it renders <DevApp> (mock services + sample
// document) for local component development, per the target architecture's
// app/development-shell/ folder.

import React from 'react';
import { createRoot } from 'react-dom/client';
import { DevApp } from '../src/app/development-shell/DevApp.js';

const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <DevApp />
  </React.StrictMode>,
);
