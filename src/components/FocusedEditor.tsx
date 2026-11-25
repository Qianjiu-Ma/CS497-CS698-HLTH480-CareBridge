import { Check, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { l10n } from '../utils/localization';
import { useOverlayScrollbars } from '../utils/overlayScrollbars';
import { Button, ControlledDialog } from './WorkspaceUi';

type Props = {
  title: string;
  subtitle?: ReactNode;
  sections?: ReactNode;
  activeSection?: string;
  children: ReactNode;
  dirty: boolean;
  readOnly?: boolean;
  fullScreen?: boolean;
  onSave: (finish: () => void) => void;
  onClose: () => void;
  onDiscard: () => void;
};

export function FocusedEditor({ title, subtitle, sections, activeSection, children, dirty, readOnly, fullScreen, onSave, onClose, onDiscard }: Props) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [open, setOpen] = useState(true);
  const body = useRef<HTMLDivElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const previousScroll = useRef(0);
  useOverlayScrollbars(body, 'y');

  useLayoutEffect(() => { body.current?.scrollTo(0, 0); }, [activeSection]);

  useLayoutEffect(() => {
    if (confirmDiscard) keepEditing.current?.focus();
  }, [confirmDiscard]);

  function resume() {
    setConfirmDiscard(false);
    requestAnimationFrame(() => {
      body.current?.scrollTo(0, previousScroll.current);
      previousFocus.current?.focus({ preventScroll: true });
    });
  }

  function dismiss() {
    if (confirmDiscard) return resume();
    if (!dirty) return setOpen(false);
    previousFocus.current = document.activeElement as HTMLElement;
    previousScroll.current = body.current?.scrollTop ?? 0;
    setConfirmDiscard(true);
  }

  return (
    <ControlledDialog open={open} label={title} onDismiss={dismiss} onAfterClose={onClose} scrollable={false}
      className={'cb-focused-editor cb-motion-dialog ' + (fullScreen ? 'cb-adaptive-detail' : 'cb-adaptive-sheet')}>
      <div className="cb-editor-layout">
        <header className="cb-editor-head">
          <div>{subtitle && <p>{subtitle}</p>}<h2>{title}</h2></div>
          <Button autoFocus variant="quiet" className="cb-editor-close" aria-label={l10n('Close')} onClick={dismiss}>
            <X aria-hidden="true" />
          </Button>
        </header>
        <form className="cb-editor-work" hidden={confirmDiscard} noValidate onSubmit={(event) => {
          event.preventDefault();
          if (open && !readOnly && dirty && !confirmDiscard) onSave(() => setOpen(false));
        }}>
          {sections}
          <div className="cb-editor-body" ref={body}>{children}</div>
          {!readOnly && <footer className="cb-editor-footer">
            <Button variant="quiet" onClick={dismiss}>{l10n('Cancel')}</Button>
            <Button variant="primary" type="submit" disabled={!dirty}>
              <Check aria-hidden="true" /> {l10n('Save changes')}
            </Button>
          </footer>}
        </form>
        {confirmDiscard && <div className="cb-editor-discard">
          <h3>{l10n('Discard draft?')}</h3>
          <p>{l10n('Unsaved changes will be lost.')}</p>
          <div className="cb-editor-footer">
            <Button ref={keepEditing} onClick={resume}>{l10n('Keep editing')}</Button>
            <Button variant="danger" onClick={() => { onDiscard(); setOpen(false); }}>{l10n('Discard')}</Button>
          </div>
        </div>}
      </div>
    </ControlledDialog>
  );
}
