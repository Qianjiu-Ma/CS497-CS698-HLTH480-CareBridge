import { OverlayScrollbars } from 'overlayscrollbars';
import { useLayoutEffect, type RefObject } from 'react';

export function enhanceScrollbars(target: HTMLElement, axes: 'x' | 'y' | 'both' = 'both') {
  const { scrollbarsHiding, scrollbarsOverlaid } = OverlayScrollbars.env();
  if (!scrollbarsHiding || (scrollbarsOverlaid.x && scrollbarsOverlaid.y)) return;
  const forcedColors = window.matchMedia('(forced-colors: active)');
  let instance: OverlayScrollbars | undefined;

  function update() {
    if (forcedColors.matches) {
      instance?.destroy();
      instance = undefined;
      return;
    }
    if (instance) return;

    // Use the existing scroll container, including the document for the body target.
    instance = OverlayScrollbars({
      target,
      elements: { viewport: target },
    }, {
      overflow: { x: axes === 'y' ? 'hidden' : 'scroll', y: axes === 'x' ? 'hidden' : 'scroll' },
      scrollbars: {
        theme: 'os-theme-carebridge',
        autoHide: 'scroll',
        autoHideDelay: 650,
        autoHideSuspend: true,
        pointers: ['mouse', 'pen'],
      },
    });
    const { scrollbarHorizontal, scrollbarVertical } = instance.elements();
    for (const { scrollbar } of [scrollbarHorizontal, scrollbarVertical]) {
      scrollbar.setAttribute('aria-hidden', 'true');
      scrollbar.addEventListener('mousedown', (event) => event.preventDefault());
    }
  }

  update();
  forcedColors.addEventListener('change', update);
  return () => {
    forcedColors.removeEventListener('change', update);
    instance?.destroy();
  };
}

export function useOverlayScrollbars(ref: RefObject<HTMLElement | null>, axes: 'x' | 'y' | 'both', enabled = true) {
  useLayoutEffect(() => {
    if (enabled && ref.current) return enhanceScrollbars(ref.current, axes);
  }, [ref, axes, enabled]);
}
