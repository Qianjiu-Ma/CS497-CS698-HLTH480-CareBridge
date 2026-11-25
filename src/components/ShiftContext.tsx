import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import type { ShiftHeader } from '../types/handoff';
import { formatUiDate, l10n, localizedShift } from '../utils/localization';
import { Button, ControlledDialog } from './WorkspaceUi';

export function ShiftContext({ header, chargeNurse }: { header: ShiftHeader; chargeNurse: string }) {
  const [open, setOpen] = useState(false);
  const title = l10n('Current shift');
  const shiftName = l10n(header.shift.split(' (', 1)[0]);
  const displayDate = formatUiDate(new Date(header.date + 'T00:00:00Z'), { dateStyle: 'medium', timeZone: 'UTC' });
  const details = [
    { label: 'Unit', value: <bdi>{header.unit}</bdi> },
    { label: 'Date', value: <time dateTime={header.date}>{displayDate || header.date}</time> },
    { label: 'Shift', value: localizedShift(header.shift) },
    { label: 'Outgoing staff', value: <bdi>{header.outgoingPsw}</bdi> },
    { label: 'Incoming staff', value: <bdi>{header.incomingPsw}</bdi> },
    { label: 'Charge nurse', value: <bdi>{chargeNurse}</bdi> },
  ];

  return <>
    <button type="button" className="cb-context-trigger" aria-haspopup="dialog" aria-expanded={open}
      aria-label={[title, header.unit, shiftName].join(' · ')} onClick={(event) => {
        event.currentTarget.focus({ preventScroll: true });
        setOpen(true);
      }}>
      <bdi className="cb-context-unit">{header.unit}</bdi>
      <span aria-hidden="true">·</span>
      <span>{shiftName}</span>
      <ChevronDown aria-hidden="true" />
    </button>
    <ControlledDialog open={open} label={title} onDismiss={() => setOpen(false)}
      className="cb-context-dialog cb-adaptive-detail cb-motion-dialog">
      <div className="cb-context-content">
        <div className="cb-context-heading cb-adaptive-head">
          <h2>{title}</h2>
          <Button autoFocus variant="quiet" className="cb-context-close" aria-label={l10n('Close')} onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <dl className="cb-panel cb-context-list">
          {details.map(({ label, value }) => <div key={label}>
            <dt>{l10n(label)}</dt><dd>{value}</dd>
          </div>)}
        </dl>
        <div className="cb-context-footer">
          <Button variant="quiet" onClick={() => setOpen(false)}>{l10n('Close')}</Button>
        </div>
      </div>
    </ControlledDialog>
  </>;
}
