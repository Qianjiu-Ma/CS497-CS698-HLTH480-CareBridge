import { useSyncExternalStore } from 'react';

const query = '(max-width: 700px)';

function subscribe(onChange: () => void) {
  const compact = window.matchMedia(query);
  compact.addEventListener('change', onChange);
  return () => compact.removeEventListener('change', onChange);
}

export function useCompactLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
