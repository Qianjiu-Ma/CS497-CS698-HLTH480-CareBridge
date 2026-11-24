import React from 'react';
import { Info } from 'lucide-react';

export const PrototypeBanner: React.FC = () => {
  return (
    <div className="bg-slate-100 border-b border-slate-200 text-slate-600 px-4 py-1.5 text-xs no-print">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="font-semibold text-slate-700">
            Prototype · Demo Data Only
          </span>
          <span className="hidden sm:inline text-slate-400">·</span>
          <span className="hidden sm:inline text-slate-600">
            Fictional residents (Rooms 101–106) and staff. No real health records.
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Human review and confirmation required before EMR submission
        </div>
      </div>
    </div>
  );
};
