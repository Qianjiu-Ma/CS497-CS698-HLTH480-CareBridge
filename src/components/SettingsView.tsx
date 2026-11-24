import React from 'react';
import { AlertThresholds } from '../types/handoff';
import {
  Sliders,
  Printer,
  Shield,
  Lock,
  Cloud,
  FileCheck,
  Sparkles,
  RotateCcw,
  OctagonAlert,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  STOP_AND_WATCH_CODES,
  DEFAULT_CODE_TIERS,
  TIER_METADATA,
  StopAndWatchCodeConfig,
  SeverityTier,
} from '../data/stopAndWatchCodes';

interface SettingsViewProps {
  thresholds: AlertThresholds;
  onUpdateThresholds: (thresholds: AlertThresholds) => void;
  onPrintPaperFallback: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  thresholds,
  onUpdateThresholds,
  onPrintPaperFallback,
}) => {
  const currentCodeTiers = thresholds.customCodeTiers || DEFAULT_CODE_TIERS;

  const handleThresholdChange = (field: keyof AlertThresholds, value: number) => {
    onUpdateThresholds({
      ...thresholds,
      [field]: value,
    });
  };

  const handleCodeTierChange = (codeId: string, tier: 1 | 2 | 3) => {
    onUpdateThresholds({
      ...thresholds,
      customCodeTiers: {
        ...currentCodeTiers,
        [codeId]: tier,
      },
    });
  };

  const handleResetTiers = () => {
    onUpdateThresholds({
      ...thresholds,
      customCodeTiers: { ...DEFAULT_CODE_TIERS },
    });
  };

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-teal-700" />
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Settings & Clinical Thresholds
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure deterministic rule thresholds, customize Stop & Watch severity tiers, review prototype architecture, and print official paper backups.
          </p>
        </div>

        <button
          onClick={onPrintPaperFallback}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Blank Paper Sheet (Official Fallback)</span>
        </button>
      </div>

      {/* Stop & Watch Severity Settings Editor */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-teal-700" />
              <span>Stop and Watch Severity Tier Assignments</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Customize the severity tier assigned to each of the 12 INTERACT™ warning codes.
            </p>
          </div>

          <button
            onClick={handleResetTiers}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Recommended Defaults</span>
          </button>
        </div>

        {/* Prototype Proposal Warning Notice */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-amber-950 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Clinical Proposal Notice:</span>
          </p>
          <p className="text-amber-900 leading-relaxed text-[11px] pl-5.5">
            Severity tiers are a prototype proposal and must be reviewed and approved by Schlegel Villages nursing leadership. They are not part of the official INTERACT tool. All alerts and tiers are decision support only. The charge nurse makes all clinical decisions.
          </p>
        </div>

        {/* 12 Code Tier Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {STOP_AND_WATCH_CODES.map((c: StopAndWatchCodeConfig) => {
            const currentTier = (currentCodeTiers[c.id] ?? c.defaultTier) as SeverityTier;
            const tierMeta = TIER_METADATA[currentTier];

            return (
              <div
                key={c.id}
                className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {c.letter} ({c.shortLabel})
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${tierMeta.badgeBg} ${tierMeta.badgeColor} ${tierMeta.badgeBorder}`}
                    >
                      {currentTier === 3 ? (
                        <OctagonAlert className="w-3 h-3 text-purple-700" />
                      ) : currentTier === 2 ? (
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                      ) : (
                        <Info className="w-3 h-3 text-sky-700" />
                      )}
                      <span>Tier {currentTier}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                    {c.plainLanguageDescription}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Tier:</span>
                  <select
                    value={currentTier}
                    onChange={(e) =>
                      handleCodeTierChange(c.id, Number(e.target.value) as 1 | 2 | 3)
                    }
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 cursor-pointer"
                  >
                    <option value={1}>Tier 1 – Monitor (Blue)</option>
                    <option value={2}>Tier 2 – Report This Shift (Amber)</option>
                    <option value={3}>Tier 3 – Report Now (Purple)</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deterministic Rule Thresholds Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Deterministic Decision Support Thresholds
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Alerts in this application are deterministic rules in code, not AI guesses. Adjust threshold values for clinical protocol compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bowel Movement Alert Hours */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              No BM Alert (Hours)
            </label>
            <input
              type="number"
              value={thresholds.bowelMovementHoursThreshold}
              onChange={(e) =>
                handleThresholdChange('bowelMovementHoursThreshold', Number(e.target.value))
              }
              className="w-full font-mono text-xs p-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 block">
              Default 48h (triggers warning before 72h / 3 days Code N).
            </span>
          </div>

          {/* Fluid Intake Minimum mL */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Daily Min Fluids (mL)
            </label>
            <input
              type="number"
              value={thresholds.fluidIntakeMinMl}
              onChange={(e) =>
                handleThresholdChange('fluidIntakeMinMl', Number(e.target.value))
              }
              className="w-full font-mono text-xs p-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 block">
              Default 1000 mL (flags under-hydration for next shift).
            </span>
          </div>

          {/* Weight Change Kg */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Weight Change Alert (kg)
            </label>
            <input
              type="number"
              step="0.5"
              value={thresholds.weightChangeKgThreshold}
              onChange={(e) =>
                handleThresholdChange('weightChangeKgThreshold', Number(e.target.value))
              }
              className="w-full font-mono text-xs p-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 block">
              Default 2.0 kg between entries (triggers Code W).
            </span>
          </div>

          {/* Repositioning Max Hours */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Repositioning Due (Hours)
            </label>
            <input
              type="number"
              step="0.5"
              value={thresholds.repositioningMaxHours}
              onChange={(e) =>
                handleThresholdChange('repositioningMaxHours', Number(e.target.value))
              }
              className="w-full font-mono text-xs p-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 block">
              Default 2.0 hours (Q2H standard for pressure injury relief).
            </span>
          </div>

          {/* Voice Silence Buffer (0.5s to 2.0s) */}
          <div className="bg-slate-50 p-3 rounded-lg border border-teal-200 bg-teal-50/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-teal-950">
                Voice Silence Buffer (Seconds)
              </label>
              <span className="text-xs font-mono font-bold text-teal-800">
                {(thresholds.silenceBufferSeconds ?? 0.8).toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={thresholds.silenceBufferSeconds ?? 0.8}
              onChange={(e) =>
                handleThresholdChange('silenceBufferSeconds', parseFloat(e.target.value))
              }
              className="w-full accent-teal-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.5s (Fastest)</span>
              <span>Default 0.8s</span>
              <span>2.0s (Deliberate)</span>
            </div>
            <span className="text-[10px] text-teal-800 block">
              Silence pause before speech is buffered and sent for extraction. Sentence-ending punctuation triggers immediately.
            </span>
          </div>
        </div>
      </div>

      {/* Privacy, Security & Architecture Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-700" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            About this Prototype · Privacy, Security & Operational Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-teal-700" />
              <span>Transmitter-Only Architecture (No Device Storage)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Runs on facility-managed laptops, never personal devices. The laptop acts strictly as a transmitter, never as long-term storage. Audio recordings are never stored; audio streams are converted to text and immediately discarded.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-teal-700" />
              <span>Canadian Data Residency & Role-Based Access</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              In production, data resides inside Canadian cloud facilities (e.g., Montreal/Toronto GCP regions) behind healthcare facility VPN and strict role-based access control (RBAC). In this prototype, mock in-memory storage is used.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Mandatory Human Review & Confirmation</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              The AI acts strictly as a documentation assistant and never makes clinical decisions. Because transcription or translation nuances occur, every AI-populated field is tagged &ldquo;Pending Confirmation&rdquo; until reviewed and confirmed by staff.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-teal-700" />
              <span>Official Physical Paper Fallback</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              If network connectivity or hardware fails, staff have instant access to print the identical physical paper shift handoff sheet. The workflow maintains 100% parity between digital and paper tools.
            </p>
          </div>
        </div>
      </div>

      {/* Future Phase Card */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-5 text-xs space-y-2 opacity-85">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Future Phase Roadmap (Concept Demonstration)
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
            Coming Soon · Phase 2
          </span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>Historical Contradiction Detection & Proactive Reminders:</strong> Future integration with the facility&rsquo;s PointClickCare EMR data lake will automatically compare current spoken reports against the resident&rsquo;s 30-day baseline. If a resident is noted as &ldquo;ate normally&rdquo; while meal tracking logs &lt;25% for 3 consecutive days, the assistant will surface a gentle validation query to ensure continuity of care.
        </p>
      </div>
    </div>
  );
};

