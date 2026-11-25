import { l10n } from '../utils/localization';
import { forwardRef, ReactNode, ButtonHTMLAttributes, useLayoutEffect, useRef, useState } from 'react';
import { dismissDialog, handleDialogEscape } from '../utils/dialogMotion';
import { ShieldCheck } from 'lucide-react';
import { useOverlayScrollbars } from '../utils/overlayScrollbars';

export const PageHeader = forwardRef<HTMLHeadingElement, {
  title: string;
  actions?: ReactNode;
  className?: string;
}>(({ title, actions, className = '' }, ref) => (
  <header className={'cb-page-heading ' + className}>
    <div className="cb-heading-copy">
      <h1 ref={ref} tabIndex={ref ? -1 : undefined}>{title}</h1>
    </div>
    {actions && <div className="cb-page-actions">{actions}</div>}
  </header>
));

export function WorkspaceFooter({ children, notice }: {
  children?: ReactNode; notice?: string;
}) {
  return <footer className="cb-workspace-footer">
    <p><ShieldCheck /> {notice || l10n("Decision support only · Clinical decisions remain with the nurse.")}</p>
    {children && <div className="cb-footer-actions">{children}</div>}
  </footer>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger' | 'secondary';
}>(({ variant = 'secondary', className = '', type = 'button', ...props }, ref) => (
  <button {...props} ref={ref} type={type} className={'cb-button cb-button--' + variant + ' ' + className} />
));

export function DraftDiscard({ titleId, context, onKeepEditing, onDiscard }: {
  titleId?: string;
  context?: ReactNode;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const keepEditing = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { keepEditing.current?.focus(); }, []);

  return <div className="cb-editor-discard">
    <h3 id={titleId}>{l10n('Discard draft?')}</h3>
    {context && <p>{context}</p>}
    <p>{l10n('Unsaved changes will be lost.')}</p>
    <div className="cb-editor-footer">
      <Button ref={keepEditing} onClick={onKeepEditing}>{l10n('Keep editing')}</Button>
      <Button variant="danger" onClick={onDiscard}>{l10n('Discard')}</Button>
    </div>
  </div>;
}

export function StatusToast({ children, announce = true }: { children?: ReactNode; announce?: boolean }) {
  return <div className={children ? 'cb-toast' : 'sr-only'} role={announce ? 'status' : undefined}>{children}</div>;
}

export function ControlledDialog({ open, onDismiss, onAfterClose, label, className, fallbackFocusId, scrollable = true, children }: {
  open: boolean;
  onDismiss: () => void;
  onAfterClose?: () => void;
  label: string;
  className: string;
  fallbackFocusId?: string;
  scrollable?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [present, setPresent] = useState(open);
  const afterClose = useRef(onAfterClose);
  afterClose.current = onAfterClose;

  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      setPresent(true);
      return;
    }
    return dismissDialog(dialog, () => {
      setPresent(false);
      if (fallbackFocusId && document.activeElement === document.body) {
        document.getElementById(fallbackFocusId)?.focus({ preventScroll: true });
      }
      afterClose.current?.();
    });
  }, [open, fallbackFocusId]);
  useOverlayScrollbars(ref, 'both', (open || present) && scrollable);

  return (
    <dialog ref={ref} className={'cb-controlled-dialog no-print ' + className} aria-label={label}
      onKeyDown={(event) => { if (open) handleDialogEscape(event, onDismiss); }}
      onCancel={(event) => {
        event.preventDefault();
        if (open) onDismiss();
      }}
      onClick={(event) => {
        if (!open || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
      }}>
      {(open || present) && children}
    </dialog>
  );
}
