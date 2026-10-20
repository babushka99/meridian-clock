// Preferences live in chrome.storage.local (survives restarts and extension updates, and
// chrome.storage.onChanged keeps every open World Time Ruler tab in sync). Outside an extension
// (vite dev preview) it falls back to localStorage + the `storage` event.
import { sanitizePrefs, type Prefs } from './prefs';

export const STORAGE_KEY = 'wtr.prefs';
const ext = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function loadPrefs(): Promise<Prefs> {
  try {
    if (ext) return sanitizePrefs((await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY]);
    const s = localStorage.getItem(STORAGE_KEY);
    return sanitizePrefs(s ? JSON.parse(s) : null);
  } catch {
    return sanitizePrefs(null);
  }
}

export async function savePrefs(p: Prefs): Promise<void> {
  if (ext) await chrome.storage.local.set({ [STORAGE_KEY]: p });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/** Calls back with prefs written by any tab (including, in the extension, this one). */
export function subscribePrefs(cb: (p: Prefs) => void): () => void {
  if (ext) {
    const fn = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY]) cb(sanitizePrefs(changes[STORAGE_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(fn);
    return () => chrome.storage.onChanged.removeListener(fn);
  }
  const fn = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    try { cb(sanitizePrefs(e.newValue ? JSON.parse(e.newValue) : null)); } catch { /* ignore malformed */ }
  };
  window.addEventListener('storage', fn);
  return () => window.removeEventListener('storage', fn);
}
