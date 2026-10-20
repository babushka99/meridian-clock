import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Bundled fonts (SIL OFL 1.1) — every unicode-range subset ships in the package; nothing is fetched remotely.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
