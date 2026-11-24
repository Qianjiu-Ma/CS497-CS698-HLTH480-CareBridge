import { l10n } from '../utils/localization';
import { ClinicalText } from './ClinicalText';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AnythingElseSectionProps {
  value: string;
  onChange: (val: string) => void;
  isLocked?: boolean;
}

export const AnythingElseSection: React.FC<AnythingElseSectionProps> = ({
  value,
  onChange,
  isLocked = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const trimmed = value.trim();

  return (
    <div className="cb-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-xs leading-relaxed">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-slate-900 shrink-0">{l10n("Unit notes")}</span>
            {!isEditing && (
              <button
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && setIsEditing(true)}
                className={`text-start rounded px-1 -mx-1 transition-colors ${
                  !isLocked ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'
                } ${trimmed ? 'text-slate-700' : 'text-slate-400 italic'}`}
              >
                {trimmed ? <bdi>{value}</bdi> : l10n("Equipment, supplies, or unit repairs for next shift")}
              </button>
            )}
          </div>
          {!isEditing && <ClinicalText text={value} previewOnly />}
        </div>

        {!isLocked && (
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <span>{isEditing ? l10n("Done") : trimmed ? l10n("Edit") : l10n("Add")}</span>
            {isEditing ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {isEditing && (
        <div className="mt-2.5">
          <textarea dir="auto"
            aria-label={l10n("Unit notes")}
            value={value}
            disabled={isLocked}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            autoFocus
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-70 leading-relaxed"
            placeholder={l10n("Equipment, supplies, tub room lifts, or unit reminders for next shift...")}
          />
        </div>
      )}
    </div>
  );
};
