import { l10n, localizedShift } from '../utils/localization';
import React, { useState, useEffect } from 'react';
import { ControlledDialog } from './WorkspaceUi';
import {
  HandoffRow,
  ShiftHeader,
  DeterministicAlert,
} from '../types/handoff';
import {
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Info,
  OctagonAlert,
  UserCheck,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  computeRowSeverity,
  TIER_METADATA,
  formatCodeChip,
} from '../data/stopAndWatchCodes';
import { StopAndWatchIconBadge } from './StopAndWatchIconBadge';

interface ConfirmSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  header: ShiftHeader;
  rows: HandoffRow[];
  anythingElse: string;
  alerts: DeterministicAlert[];
  customCodeTiers?: Record<string, 1 | 2 | 3>;
  onConfirmAndSubmit: (overrideReason?: string) => void;
  onGoToResident?: (room: string) => void;
}

export const ConfirmSubmitModal: React.FC<ConfirmSubmitModalProps> = ({
  isOpen,
  onClose,
  header,
  rows,
  anythingElse,
  alerts = [],
  customCodeTiers,
  onConfirmAndSubmit,
  onGoToResident,
}) => {
  const [overrideReason, setOverrideReason] = useState('');
  const [acknowledgedOverride, setAcknowledgedOverride] = useState(false);
  const [acknowledgedPendingAi, setAcknowledgedPendingAi] = useState(false);

  useEffect(() => {
    if (!isOpen) setAcknowledgedPendingAi(false);
  }, [isOpen]);

  const evaluatedRows = rows.map((r) => {
    const codes = r.changeCodes?.value || [];
    const severity = computeRowSeverity(codes, { prevShiftTier: r.prevShiftTier, customTiers: customCodeTiers });
    const told = r.toldNurse?.value === true;
    const hasPending = Boolean(
      r.done?.isPendingConfirmation ||
        r.notDoneNextShift?.isPendingConfirmation ||
        r.changeNote?.isPendingConfirmation ||
        r.changeCodes?.isPendingConfirmation ||
        r.mltcDetails?.fluidIntakeMl?.isPendingConfirmation ||
        r.mltcDetails?.weightKg?.isPendingConfirmation ||
        r.mltcDetails?.bowelMovement?.isPendingConfirmation ||
        r.mltcDetails?.lastRepositionTime?.isPendingConfirmation ||
        r.mltcDetails?.qualitativeObservations?.isPendingConfirmation ||
        (r.careRequirements || []).some((req) => req.isPendingConfirmation)
    );
    return {
      row: r,
      codes,
      severity,
      told,
      hasPending,
      isUnnotified: codes.length > 0 && !told,
    };
  });

  const unnotifiedTier3 = evaluatedRows.filter(
    (e) => e.isUnnotified && e.severity?.effectiveTier === 3
  );
  const unnotifiedTier2 = evaluatedRows.filter(
    (e) => e.isUnnotified && e.severity?.effectiveTier === 2
  );
  const pendingReviewRooms = evaluatedRows.filter((e) => e.hasPending);
  const missingDocAlerts = alerts.filter(
    (a) => a.type === 'missing_care' || a.type === 'missing_required'
  );
  const bmOverdueAlerts = alerts.filter((a) => a.type === 'bm_overdue');

  const hasTier3Blocker = unnotifiedTier3.length > 0;
  const hasTier2Escalation = unnotifiedTier2.length > 0;
  const hasPendingAiItems = pendingReviewRooms.length > 0;

  const handleSubmit = () => {
    if (hasTier3Blocker) return;
    if (hasTier2Escalation && (!acknowledgedOverride || !overrideReason.trim())) return;
    if (hasPendingAiItems && !acknowledgedPendingAi) return;
    onConfirmAndSubmit(hasTier2Escalation ? overrideReason.trim() : undefined);
  };

  return (
    <ControlledDialog open={isOpen} onDismiss={onClose} label={l10n("Confirm and submit shift handoff")} className="cb-review-modal cb-adaptive-detail cb-motion-dialog">
      <div className="cb-review-content bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 text-xs text-slate-800">
      {/* Header */}
      <div className="cb-adaptive-head flex items-start justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-teal-700" />
            <span>{l10n("Confirm & Submit Shift Handoff")}</span>
          </h2>
          <div className="text-slate-500 mt-0.5 font-mono tabular-nums">
            {header.unit} · {localizedShift(header.shift)} · {header.date}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cb-adaptive-close text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
          title={l10n("Close (Esc)")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Shift Sign-off Overview */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-slate-500 font-medium block text-[11px]">{l10n("Outgoing Staff")}</span>
          <span className="font-semibold text-slate-900">{header.outgoingPsw}</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium block text-[11px]">{l10n("Incoming Staff")}</span>
          <span className="font-semibold text-slate-900">{header.incomingPsw}</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium block text-[11px]">{l10n("Residents")}</span>
          <span className="font-semibold text-slate-900 font-mono tabular-nums">
            {rows.length}{" " + l10n("Assigned")}
          </span>
        </div>
      </div>

      {/* Resident Summary */}
      <div className="space-y-2">
        <div className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
          {l10n("Resident Changes & Follow-Ups")}
        </div>
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
          {evaluatedRows.map(({ row: r, codes, severity, told }) => {
            const hasChange =
              codes.length > 0 || (r.changeNote?.value && r.changeNote.value !== 'No change');
            const hasNextNote = Boolean(
              r.notDoneNextShift?.value && r.notDoneNextShift.value !== '—'
            );
            const reqTasks = r.careRequirements || [];
            const hasNextShift = hasNextNote || reqTasks.length > 0;
            const tierMeta = severity ? TIER_METADATA[severity.effectiveTier] : null;

            return (
              <div key={r.room} className="p-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 font-mono tabular-nums">
                      {r.room}
                    </span>
                    <span className="font-semibold text-slate-900">{r.residentName}</span>
                    {tierMeta && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tierMeta.badgeBg} ${tierMeta.badgeColor} ${tierMeta.badgeBorder}`}
                      >
                        {tierMeta.tier === 3 ? (
                          <OctagonAlert className="w-3 h-3" />
                        ) : tierMeta.tier === 2 ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Info className="w-3 h-3" />
                        )}
                        <span>{l10n(tierMeta.label)}</span>
                      </span>
                    )}
                  </div>

                  {hasChange && (
                    <div className="text-slate-700 flex flex-wrap items-center gap-1.5">
                      {codes.map((c) => (
                        <StopAndWatchIconBadge
                          key={c}
                          codeId={c}
                          size="sm"
                          customTiers={customCodeTiers}
                        />
                      ))}
                      <span className="text-slate-700 italic">{r.changeNote?.value}</span>
                    </div>
                  )}

                  {hasNextNote && (
                    <div className="text-teal-800 font-medium">
                      {l10n("Next Shift:") + " "}{r.notDoneNextShift?.value}
                    </div>
                  )}
                  {reqTasks.length > 0 && (
                    <ul className="space-y-0.5 text-[11px] text-teal-900">
                      {reqTasks.map((req) => (
                        <li key={req.id} className={req.completed ? 'line-through text-slate-400' : ''}>
                          <span className="font-semibold">{req.category}:</span> {req.action_item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!hasChange && !hasNextShift && (
                    <div className="text-slate-500 text-[11px]">
                      {l10n("Care delivered per care plan.")}
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-end">
                  {told ? (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold text-[11px] inline-flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      <span>{r.nurseInitials?.value || l10n("RN")}</span>
                    </span>
                  ) : severity?.effectiveTier === 3 ? (
                    <span className="text-purple-950 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded font-semibold text-[11px] inline-flex items-center gap-1">
                      <OctagonAlert className="w-3 h-3 text-purple-700" />
                      <span>{l10n("Notify NOW")}</span>
                    </span>
                  ) : severity?.effectiveTier === 2 ? (
                    <span className="text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-semibold text-[11px] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                      <span>{l10n("Not Notified")}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      {codes.length > 0 ? l10n("Monitor") : l10n("Routine")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {anythingElse && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
          <span className="font-semibold text-slate-700">{l10n("Unit Note:")}</span>{' '}
          <span className="text-slate-800">{anythingElse}</span>
        </div>
      )}

      {/* TIER 3 BLOCKER */}
      {hasTier3Blocker && (
        <div className="p-4 bg-purple-50 border border-purple-300 rounded-xl space-y-2.5">
          <div className="flex items-start gap-2.5">
            <OctagonAlert className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wide">
                {l10n("Submission Blocked: Tier 3 – Report to Nurse Now")}
              </h4>
              <p className="text-purple-900 leading-relaxed">
                {l10n("Notify the Charge Nurse immediately and record their initials before submitting.") + " "}<strong>{l10n("Overrides are not permitted for Tier 3.")}</strong>
              </p>
              <div className="space-y-1.5">
                {unnotifiedTier3.map(({ row: u, codes }) => (
                  <div
                    key={u.room}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white border border-purple-200 rounded-lg p-2"
                  >
                    <span className="font-semibold text-purple-950">
                      {l10n("Rm") + " "}{u.room} ({u.residentName}): {codes.map(formatCodeChip).join(', ')}
                    </span>
                    {onGoToResident && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onGoToResident(u.room);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        <span>{l10n("Go to Rm") + " "}{u.room}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIER 2 WARNING */}
      {!hasTier3Blocker && hasTier2Escalation && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wide">
                {l10n("Tier 2 Warning – Charge Nurse Notification Pending")}
              </h4>
              <div className="space-y-1.5">
                {unnotifiedTier2.map(({ row: u, codes }) => (
                  <div
                    key={u.room}
                    className="flex flex-wrap items-center justify-between gap-2 bg-white border border-amber-200 rounded-lg p-2"
                  >
                    <span className="font-semibold text-amber-950">
                      {l10n("Rm") + " "}{u.room} ({u.residentName}): {codes.map(formatCodeChip).join(', ')}
                    </span>
                    {onGoToResident && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onGoToResident(u.room);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        <span>{l10n("Go to Rm") + " "}{u.room}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgedOverride}
                onChange={(e) => setAcknowledgedOverride(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-700 rounded border-amber-300 focus:ring-amber-700"
              />
              <span className="text-amber-950 font-semibold leading-tight">
                {l10n("Submit with Clinical Override Reason (permanently logged in EMR audit trail)")}
              </span>
            </label>

            {acknowledgedOverride && (
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={l10n("e.g. Charge Nurse was in an emergency; verbal update given in hallway.")}
                className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            )}
          </div>
        </div>
      )}

      {/* DOCUMENTATION COMPLETENESS & AI REVIEW SAFEGUARD */}
      {(hasPendingAiItems || missingDocAlerts.length > 0 || bmOverdueAlerts.length > 0) && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-teal-700 shrink-0" />
            <span>{l10n("Documentation & Human Review Check")}</span>
          </div>

          {(missingDocAlerts.length > 0 || bmOverdueAlerts.length > 0) && (
            <div className="space-y-1.5">
              {bmOverdueAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-rose-50/70 border border-rose-200 rounded-lg px-2.5 py-1.5 text-rose-950"
                >
                  <span>
                    <span className="font-semibold">{l10n("Rm") + " "}{a.room} ({a.residentName}):</span>{' '}
                    {l10n(a.title)}
                  </span>
                  {onGoToResident && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToResident(a.room);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 hover:underline cursor-pointer"
                    >
                      <span>{l10n("Go to Rm") + " "}{a.room}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {missingDocAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
                >
                  <span>
                    <span className="font-semibold">{l10n("Rm") + " "}{a.room} ({a.residentName}):</span>{' '}
                    {a.title}
                  </span>
                  {onGoToResident && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToResident(a.room);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:underline cursor-pointer"
                    >
                      <span>{l10n("Go to Rm") + " "}{a.room}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {hasPendingAiItems && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-amber-950">
                <span className="font-semibold">
                {l10n('Residents with unconfirmed AI-extracted notes: {{count}}', { count: pendingReviewRooms.length })}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pendingReviewRooms.map(({ row: pr }) =>
                    onGoToResident ? (
                      <button
                        key={pr.room}
                        type="button"
                        onClick={() => {
                          onClose();
                          onGoToResident(pr.room);
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-amber-100 border border-amber-300 rounded text-[11px] font-semibold text-amber-950 cursor-pointer"
                      >
                        {l10n("Rm") + " "}{pr.room}
                      </button>
                    ) : null
                  )}
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-amber-950">
                <input
                  type="checkbox"
                  checked={acknowledgedPendingAi}
                  onChange={(e) => setAcknowledgedPendingAi(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-teal-700 rounded border-amber-300 focus:ring-teal-700"
                />
                <span className="font-medium leading-tight">
                  {l10n("I have reviewed all pending AI-extracted items against the residents' actual care.")}
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        {l10n("All alerts and severity tiers are decision support only; the Charge Nurse makes all clinical decisions.")}
      </p>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
        >
          {l10n("Back")}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            hasTier3Blocker ||
            (hasTier2Escalation && (!acknowledgedOverride || !overrideReason.trim())) ||
            (hasPendingAiItems && !acknowledgedPendingAi)
          }
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <CheckCircle className="w-4 h-4" />
          <span>
            {hasTier3Blocker
              ? l10n("Blocked by Tier 3")
              : l10n("Confirm & Submit Handoff")}
          </span>
        </button>
      </div>
      </div>
    </ControlledDialog>
  );
};
