import { useEffect, useSyncExternalStore } from 'react';

const query = '(max-width: 700px)';

function subscribe(onChange: () => void) {
  const compact = window.matchMedia(query);
  compact.addEventListener('change', onChange);
  return () => compact.removeEventListener('change', onChange);
}

export function useCompactLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

export function useCompactDialogViewport(compact: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!compact || !viewport) return;
    const style = document.documentElement.style;
    const property = '--cb-visible-height';
    const update = () => {
      if (viewport.scale === 1 && viewport.height < window.innerHeight) {
        style.setProperty(property, Math.round(viewport.height) + 'px');
      } else style.removeProperty(property);
    };
    update();
    viewport.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      style.removeProperty(property);
    };
  }, [compact]);
}
