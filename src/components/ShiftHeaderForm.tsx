import { l10n } from '../utils/localization';
import React, { useState } from 'react';
import { ShiftHeader } from '../types/handoff';
import { Pencil } from 'lucide-react';
import { Button, PageHeader } from './WorkspaceUi';
import { SelectPopover } from './SelectPopover';

interface ShiftHeaderFormProps {
  header: ShiftHeader;
  onChange: (header: ShiftHeader) => void;
  isLocked?: boolean;
}

export const ShiftHeaderForm: React.FC<ShiftHeaderFormProps> = ({
  header,
  onChange,
  isLocked = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (field: keyof ShiftHeader, value: string) => {
    onChange({
      ...header,
      [field]: value,
    });
  };

  const shiftLabel = header.shift.replace(/^(Day|Evening|Night) \(.*\)$/, '$1 shift');
  const outgoing = header.outgoingPsw.replace(/,\s*PSW$/i, '');
  const incoming = header.incomingPsw.replace(/,\s*PSW$/i, '');

  return (
    <div>
      <PageHeader title={l10n("Handoff")} subtitle={<>
        {header.unit} · {l10n(shiftLabel)} · {outgoing} → {incoming}
      </>} actions={<Button onClick={() => setIsEditing(!isEditing)} aria-expanded={isEditing}
        aria-controls="handoff-shift-details"><Pencil /> {isEditing ? l10n("Done") : l10n("Edit shift")}</Button>} />

      {isEditing && (
        <div id="handoff-shift-details" className="cb-panel cb-shift-form grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="shift-unit" className="block text-xs font-medium text-slate-600 mb-1">
              {l10n("Unit")}
            </label>
            <input
              type="text"
              id="shift-unit"
              value={header.unit}
              disabled={isLocked}
              onChange={(e) => handleChange('unit', e.target.value)}
              className="cb-field w-full"
              placeholder={l10n("Maple Neighborhood")}
            />
          </div>

          <div>
            <label htmlFor="shift-date" className="block text-xs font-medium text-slate-600 mb-1">
              {l10n("Date")}
            </label>
            <input
              type="date"
              id="shift-date"
              value={header.date}
              disabled={isLocked}
              onChange={(e) => handleChange('date', e.target.value)}
              className="cb-field w-full"
            />
          </div>

          <div>
            <label htmlFor="shift-shift" className="block text-xs font-medium text-slate-600 mb-1">
              {l10n("Shift")}
            </label>
            <SelectPopover id="shift-shift" label={l10n('Shift')} value={header.shift}
              disabled={isLocked} onChange={(shift) => onChange({ ...header, shift })}
              options={[
                { value: 'Day (07:00 - 15:00)', label: l10n('Day (07:00 – 15:00)') },
                { value: 'Evening (15:00 - 23:00)', label: l10n('Evening (15:00 – 23:00)') },
                { value: 'Night (23:00 - 07:00)', label: l10n('Night (23:00 – 07:00)') },
              ]} />
          </div>

          <div>
            <label htmlFor="shift-outgoingPsw" className="block text-xs font-medium text-slate-600 mb-1">
              {l10n("Outgoing staff")}
            </label>
            <input
              type="text"
              id="shift-outgoingPsw"
              value={header.outgoingPsw}
              disabled={isLocked}
              onChange={(e) => handleChange('outgoingPsw', e.target.value)}
              className="cb-field w-full"
              placeholder={l10n("J. Santos, PSW")}
            />
          </div>

          <div>
            <label htmlFor="shift-incomingPsw" className="block text-xs font-medium text-slate-600 mb-1">
              {l10n("Incoming staff")}
            </label>
            <input
              type="text"
              id="shift-incomingPsw"
              value={header.incomingPsw}
              disabled={isLocked}
              onChange={(e) => handleChange('incomingPsw', e.target.value)}
              className="cb-field w-full"
              placeholder={l10n("M. Okafor, PSW")}
            />
          </div>
        </div>
      )}
    </div>
  );
};
