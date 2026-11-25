import 'overlayscrollbars/overlayscrollbars.css';
import {createRoot} from 'react-dom/client';
import App, { readInterfacePreference } from './App.tsx';
import { loadInterfaceLocale, setInterfaceLocale } from './utils/localization';
import { enhanceScrollbars } from './utils/overlayScrollbars';
import './index.css';

const disposeScrollbars = enhanceScrollbars(document.body);
if (disposeScrollbars) import.meta.hot?.dispose(disposeScrollbars);

async function start() {
  const language = readInterfacePreference();
  try {
    await loadInterfaceLocale(language);
    setInterfaceLocale(language);
  } catch {
    setInterfaceLocale('en');
  }
  createRoot(document.getElementById('root')!).render(<App />);
}

void start();
