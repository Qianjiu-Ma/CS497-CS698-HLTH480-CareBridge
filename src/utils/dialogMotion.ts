import type { KeyboardEvent, SyntheticEvent } from 'react';

export function dismissDialog(dialog: HTMLDialogElement | null, afterClose?: () => void) {
  if (!dialog?.open) return;
  if (dialog.hasAttribute('data-cb-closing')) return;

  const style = getComputedStyle(dialog);
  dialog.style.setProperty('--cb-exit-start-transform', style.transform);
  dialog.style.setProperty('--cb-exit-start-opacity', style.opacity);
  dialog.setAttribute('data-cb-closing', '');
  const animation = dialog.getAnimations().find((item) =>
    'animationName' in item && item.animationName === 'cb-dialog-out');
  let cancelled = false;
  const blockInteraction = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const cleanup = () => {
    dialog.removeAttribute('data-cb-closing');
    dialog.style.removeProperty('--cb-exit-start-transform');
    dialog.style.removeProperty('--cb-exit-start-opacity');
    dialog.removeEventListener('click', blockInteraction, true);
    dialog.removeEventListener('submit', blockInteraction, true);
  };
  const finish = () => {
    if (cancelled) return;
    if (dialog.isConnected && dialog.open) {
      dialog.close();
      cleanup();
      afterClose?.();
    } else cleanup();
  };

  if (!animation) {
    finish();
    return;
  }
  dialog.addEventListener('click', blockInteraction, true);
  dialog.addEventListener('submit', blockInteraction, true);
  void animation.finished.then(finish, finish);
  return () => { cancelled = true; cleanup(); };
}

export function handleDialogEscape(event: KeyboardEvent<HTMLDialogElement>, onDismiss: () => void) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  event.preventDefault();
  onDismiss();
}

export function cancelDialog(event: SyntheticEvent<HTMLDialogElement>) {
  event.preventDefault();
  dismissDialog(event.currentTarget);
}
