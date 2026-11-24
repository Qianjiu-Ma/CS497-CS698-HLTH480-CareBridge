import React, { useState } from 'react';
import { ShiftHeader } from '../types/handoff';
import { Pencil } from 'lucide-react';
import { Button, PageHeader } from './WorkspaceUi';

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
      <PageHeader title="Handoff" subtitle={<>
        {header.unit} · {shiftLabel} · {outgoing} → {incoming}
      </>} actions={<Button onClick={() => setIsEditing(!isEditing)} aria-expanded={isEditing}
        aria-controls="handoff-shift-details"><Pencil /> {isEditing ? 'Done' : 'Edit shift'}</Button>} />

      {isEditing && (
        <div id="handoff-shift-details" className="cb-panel cb-shift-form grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="shift-unit" className="block text-xs font-medium text-slate-600 mb-1">
              Unit
            </label>
            <input
              type="text"
              id="shift-unit"
              value={header.unit}
              disabled={isLocked}
              onChange={(e) => handleChange('unit', e.target.value)}
              className="cb-field w-full"
              placeholder="Maple Neighborhood"
            />
          </div>

          <div>
            <label htmlFor="shift-date" className="block text-xs font-medium text-slate-600 mb-1">
              Date
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
              Shift
            </label>
            <select
              id="shift-shift"
              value={header.shift}
              disabled={isLocked}
              onChange={(e) => handleChange('shift', e.target.value)}
              className="cb-field w-full"
            >
              <option value="Day (07:00 - 15:00)">Day (07:00 – 15:00)</option>
              <option value="Evening (15:00 - 23:00)">Evening (15:00 – 23:00)</option>
              <option value="Night (23:00 - 07:00)">Night (23:00 – 07:00)</option>
            </select>
          </div>

          <div>
            <label htmlFor="shift-outgoingPsw" className="block text-xs font-medium text-slate-600 mb-1">
              Outgoing staff
            </label>
            <input
              type="text"
              id="shift-outgoingPsw"
              value={header.outgoingPsw}
              disabled={isLocked}
              onChange={(e) => handleChange('outgoingPsw', e.target.value)}
              className="cb-field w-full"
              placeholder="J. Santos, PSW"
            />
          </div>

          <div>
            <label htmlFor="shift-incomingPsw" className="block text-xs font-medium text-slate-600 mb-1">
              Incoming staff
            </label>
            <input
              type="text"
              id="shift-incomingPsw"
              value={header.incomingPsw}
              disabled={isLocked}
              onChange={(e) => handleChange('incomingPsw', e.target.value)}
              className="cb-field w-full"
              placeholder="M. Okafor, PSW"
            />
          </div>
        </div>
      )}
    </div>
  );
};
