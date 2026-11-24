import React, { useState } from 'react';
import { ShiftHeader } from '../types/handoff';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

  return (
    <div className="px-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-semibold text-slate-900">{header.unit}</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>{header.shift}</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{header.date}</span>
          <span className="text-slate-300 hidden md:inline" aria-hidden="true">·</span>
          <span className="hidden md:inline">
            <span className="text-slate-800 font-medium">{header.outgoingPsw}</span>
            <span className="text-slate-400"> → </span>
            <span className="text-slate-800 font-medium">{header.incomingPsw}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer shrink-0 active:scale-[0.98]"
        >
          <span>{isEditing ? 'Done' : 'Edit shift'}</span>
          {isEditing ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {isEditing && (
        <div className="mt-2.5 bg-white border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={header.unit}
              disabled={isLocked}
              onChange={(e) => handleChange('unit', e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-70"
              placeholder="Maple Neighborhood"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date
            </label>
            <input
              type="date"
              value={header.date}
              disabled={isLocked}
              onChange={(e) => handleChange('date', e.target.value)}
              className="w-full text-xs font-mono tabular-nums font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-70"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Shift
            </label>
            <select
              value={header.shift}
              disabled={isLocked}
              onChange={(e) => handleChange('shift', e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-70"
            >
              <option value="Day (07:00 - 15:00)">Day (07:00 – 15:00)</option>
              <option value="Evening (15:00 - 23:00)">Evening (15:00 – 23:00)</option>
              <option value="Night (23:00 - 07:00)">Night (23:00 – 07:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Outgoing staff
            </label>
            <input
              type="text"
              value={header.outgoingPsw}
              disabled={isLocked}
              onChange={(e) => handleChange('outgoingPsw', e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-70"
              placeholder="J. Santos, PSW"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Incoming staff
            </label>
            <input
              type="text"
              value={header.incomingPsw}
              disabled={isLocked}
              onChange={(e) => handleChange('incomingPsw', e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-70"
              placeholder="M. Okafor, PSW"
            />
          </div>
        </div>
      )}
    </div>
  );
};
