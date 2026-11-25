import { l10n } from '../utils/localization';
import React, { useRef, useState } from 'react';
import { useOverlayScrollbars } from '../utils/overlayScrollbars';
import {
  Info,
  AlertTriangle,
  OctagonAlert,
  ShieldAlert,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ControlledDialog } from './WorkspaceUi';
import {
  STOP_AND_WATCH_CONFIG,
  TIER_METADATA,
  SeverityTier,
} from '../data/stopAndWatchCodes';
import { getStopAndWatchIcon } from './StopAndWatchIconBadge';

interface StopAndWatchLegendProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StopAndWatchLegend: React.FC<StopAndWatchLegendProps> = ({
  isOpen,
  onClose,
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  useOverlayScrollbars(scroller, 'y', isOpen);
  const [selectedCodeId, setSelectedCodeId] = useState<string>('S');
  const [tierFilter, setTierFilter] = useState<'all' | 1 | 2 | 3>('all');

  const selectedCode =
    STOP_AND_WATCH_CONFIG.find((c) => c.id === selectedCodeId) || STOP_AND_WATCH_CONFIG[0];
  const selectedMeta = TIER_METADATA[selectedCode.defaultTier];

  const filteredCodes =
    tierFilter === 'all'
      ? STOP_AND_WATCH_CONFIG
      : STOP_AND_WATCH_CONFIG.filter((c) => c.defaultTier === tierFilter);

  const renderTierIcon = (tier: SeverityTier, className = 'w-3.5 h-3.5') => {
    switch (tier) {
      case 1:
        return <Info className={`${className} text-sky-700 shrink-0`} />;
      case 2:
        return <AlertTriangle className={`${className} text-amber-700 shrink-0`} />;
      case 3:
        return <OctagonAlert className={`${className} text-purple-700 shrink-0`} />;
    }
  };

  const currentIndex = STOP_AND_WATCH_CONFIG.findIndex((c) => c.id === selectedCodeId);

  const handlePrevCode = () => {
    const prevIdx =
      currentIndex <= 0 ? STOP_AND_WATCH_CONFIG.length - 1 : currentIndex - 1;
    setSelectedCodeId(STOP_AND_WATCH_CONFIG[prevIdx].id);
  };

  const handleNextCode = () => {
    const nextIdx =
      currentIndex >= STOP_AND_WATCH_CONFIG.length - 1 ? 0 : currentIndex + 1;
    setSelectedCodeId(STOP_AND_WATCH_CONFIG[nextIdx].id);
  };

  return (
    <ControlledDialog open={isOpen} onDismiss={onClose} label={l10n("INTERACT Stop and Watch Reference Guide")}
      className="cb-guide-drawer cb-motion-drawer" fallbackFocusId="report-more-trigger" scrollable={false}>
      <aside className="w-full bg-white h-full border-s border-slate-200 flex flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-purple-700 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {l10n("INTERACT™ Stop & Watch Clinical Guide")}
            </h2>
            <p className="text-xs text-slate-500">
              {l10n("Select any of the 12 codes below to inspect clinical criteria and nurse notification rules")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="cb-adaptive-close p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
          title={l10n("Close guide (Esc)")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div ref={scroller} className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Tier Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            {l10n("Filter by clinical severity:")}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setTierFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                tierFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {l10n("All 12")}
            </button>
            <button
              type="button"
              onClick={() => setTierFilter(tierFilter === 3 ? 'all' : 3)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors border ${
                tierFilter === 3
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-purple-50 text-purple-950 border-purple-200 hover:bg-purple-100'
              }`}
            >
              <OctagonAlert className="w-3 h-3" />
              <span>{l10n("Tier 3: Urgent")}</span>
            </button>
            <button
              type="button"
              onClick={() => setTierFilter(tierFilter === 2 ? 'all' : 2)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors border ${
                tierFilter === 2
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{l10n("Tier 2: Shift")}</span>
            </button>
            <button
              type="button"
              onClick={() => setTierFilter(tierFilter === 1 ? 'all' : 1)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors border ${
                tierFilter === 1
                  ? 'bg-sky-700 text-white border-sky-700'
                  : 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
              }`}
            >
              <Info className="w-3 h-3" />
              <span>{l10n("Tier 1: Monitor")}</span>
            </button>
          </div>
        </div>

        {/* 12 Pushable Letters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredCodes.map((code) => {
            const isSelected = code.id === selectedCodeId;
            const meta = TIER_METADATA[code.defaultTier];
            const IconComponent = getStopAndWatchIcon(code.id);

            return (
              <button
                key={code.id}
                type="button"
                onClick={() => setSelectedCodeId(code.id)}
                className={`p-2.5 rounded-xl border text-start transition-colors cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-teal-50/40 border-teal-700 ring-1 ring-teal-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      {code.letter}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 font-mono tabular-nums ${meta.badgeBg} ${meta.badgeColor} ${meta.badgeBorder}`}
                  >
                    {renderTierIcon(code.defaultTier, 'w-2.5 h-2.5')}
                    <span>{l10n("T")}{code.defaultTier}</span>
                  </span>
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-900 truncate w-full">
                  {l10n(code.shortLabel)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Explanation Panel */}
        <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center">
                {(() => {
                  const SelectedIcon = getStopAndWatchIcon(selectedCode.id);
                  return <SelectedIcon className="w-5 h-5" />;
                })()}
              </span>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300">
                    {l10n("Code") + " "}{selectedCode.letter}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    {l10n(selectedCode.plainLabel || selectedCode.label)}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${selectedMeta.badgeBg} ${selectedMeta.badgeColor} ${selectedMeta.badgeBorder}`}
                  >
                    {renderTierIcon(selectedCode.defaultTier, 'w-3 h-3')}
                    <span>{l10n(selectedMeta.heading)}</span>
                  </span>
                  <span className="text-xs text-slate-500 capitalize">
                    {selectedCode.category}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevCode}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{l10n("Prev")}</span>
              </button>
              <button
                type="button"
                onClick={handleNextCode}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                <span>{l10n("Next")}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {l10n("What to Look For")}
              </span>
              <p className="text-slate-900 leading-relaxed">
                {l10n(selectedCode.plainLanguageDescription)}
              </p>
              <p className="text-xs text-slate-500 italic pt-1">
                {l10n("Example:") + " "}{l10n(selectedCode.examplePhrase)}
              </p>
            </div>

            <div
              className={`p-3.5 rounded-lg border space-y-2 text-xs ${
                selectedCode.defaultTier === 3
                  ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                  : selectedCode.defaultTier === 2
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-sky-50/70 border-sky-200 text-sky-900'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                {renderTierIcon(selectedCode.defaultTier, 'w-4 h-4')}
                <span>{l10n("Required Clinical Protocol")}</span>
              </div>
              <p className="font-medium leading-relaxed text-sm">
                {l10n(selectedMeta.actionSummary)}
              </p>
            </div>
          </div>
        </div>
      </div>
      </aside>
    </ControlledDialog>
  );
};
