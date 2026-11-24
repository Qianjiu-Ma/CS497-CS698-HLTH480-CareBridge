import {createRoot} from 'react-dom/client';
import App, { readInterfacePreference } from './App.tsx';
import { loadInterfaceLocale, setInterfaceLocale } from './utils/localization';
import './index.css';

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
