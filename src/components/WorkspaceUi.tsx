import { forwardRef, ReactNode, ButtonHTMLAttributes, useLayoutEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';

export const PageHeader = forwardRef<HTMLHeadingElement, {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>(({ title, subtitle, actions, className = '' }, ref) => (
  <header className={'cb-page-heading ' + className}>
    <div className="cb-heading-copy">
      <h1 ref={ref} tabIndex={ref ? -1 : undefined}>{title}</h1>
      {subtitle && <p className="cb-page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="cb-page-actions">{actions}</div>}
  </header>
));

export const WorkspaceFooter = ({ children, notice }: { children?: ReactNode; notice?: string }) => (
  <footer className="cb-workspace-footer">
    <p><ShieldCheck /> {notice || 'Decision support only · Clinical decisions remain with the nurse.'}</p>
    {children && <div className="cb-footer-actions">{children}</div>}
  </footer>
);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger' | 'secondary';
}>(({ variant = 'secondary', className = '', type = 'button', ...props }, ref) => (
  <button {...props} ref={ref} type={type} className={'cb-button cb-button--' + variant + ' ' + className} />
));

export function StatusToast({ children, announce = true }: { children?: ReactNode; announce?: boolean }) {
  return <div className={children ? 'cb-toast' : 'sr-only'} role={announce ? 'status' : undefined}>{children}</div>;
}

export function ControlledDialog({ open, onDismiss, label, className, fallbackFocusId, children }: {
  open: boolean;
  onDismiss: () => void;
  label: string;
  className: string;
  fallbackFocusId?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open === open) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
      if (fallbackFocusId && document.activeElement === document.body) {
        document.getElementById(fallbackFocusId)?.focus({ preventScroll: true });
      }
    }
  }, [open, fallbackFocusId]);

  return (
    <dialog ref={ref} className={'cb-controlled-dialog no-print ' + className} aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
      }}>
      {open && children}
    </dialog>
  );
}
