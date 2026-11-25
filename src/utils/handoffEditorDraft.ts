import { useState } from 'react';

const prefix = 'carebridge_handoff_editor_v1:';

export function useHandoffEditorDraft<T>(key: string, initial: T) {
  const storageKey = prefix + key;
  const [entry, setEntry] = useState<{ original: T; draft: T }>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const stored = raw ? JSON.parse(raw) : null;
      if (stored && typeof stored === 'object' && 'original' in stored && 'draft' in stored) return stored;
    } catch {
      // The editor also works when session storage is unavailable.
    }
    return { original: initial, draft: initial };
  });
  const clear = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
  };
  const dirty = JSON.stringify(entry.original) !== JSON.stringify(entry.draft);
  function change(draft: T) {
    const next = { original: entry.original, draft };
    setEntry(next);
    if (JSON.stringify(next.original) === JSON.stringify(draft)) return clear();
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }
  return { ...entry, dirty, change, clear };
}

export function clearHandoffEditorDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage is optional. */ }
}
