import React from 'react';
import { ShiftHeader, HandoffRow } from '../types/handoff';
import {
  STOP_AND_WATCH_CODES,
  formatCodeChip,
  StopAndWatchCodeConfig,
} from '../data/stopAndWatchCodes';

interface PrintablePaperSheetProps {
  header: ShiftHeader;
  rows: HandoffRow[];
  anythingElse: string;
  isBlank?: boolean;
}

export const PrintablePaperSheet: React.FC<PrintablePaperSheetProps> = ({
  header,
  rows,
  anythingElse,
  isBlank = false,
}) => {
  return (
    <div className="print-only hidden p-8 text-black bg-white max-w-5xl mx-auto font-sans text-xs">
      {/* Header section */}
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">
              Schlegel Villages · Shift Handoff Sheet
            </h1>
            <p className="text-xs text-gray-700">
              Official Physical Fallback · Long-Term Care Continuity of Care Form
            </p>
          </div>
          <div className="text-right text-xs">
            <div>
              <strong>Form Rev:</strong> 2026-V3 (INTERACT™ Stop & Watch)
            </div>
            <div>
              <strong>Unit:</strong> {header.unit || 'Maple Neighborhood'}
            </div>
          </div>
        </div>

        {/* Meta Bar */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-2 border-t border-gray-400 text-xs">
          <div>
            <strong>Date:</strong> {isBlank ? '________________' : header.date}
          </div>
          <div>
            <strong>Shift:</strong> {isBlank ? 'Day / Eve / Night' : header.shift}
          </div>
          <div>
            <strong>Outgoing PSW:</strong> {isBlank ? '________________' : header.outgoingPsw}
          </div>
          <div>
            <strong>Incoming PSW:</strong> {isBlank ? '________________' : header.incomingPsw}
          </div>
        </div>
      </div>

      {/* Stop & Watch Reference Bar with Tier Symbols */}
      <div className="border border-black p-2.5 mb-4 bg-gray-50 text-[10px] leading-tight space-y-1.5">
        <div className="flex items-center justify-between font-bold uppercase tracking-wider border-b border-gray-300 pb-1">
          <span>INTERACT™ Stop and Watch Reference & Severity Tiers:</span>
          <span className="font-mono text-[9px] font-normal lowercase">
            [T3 🛑] Report Now · [T2 ⚠️] Report This Shift · [T1 ℹ️] Monitor
          </span>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-1">
          {STOP_AND_WATCH_CODES.map((c: StopAndWatchCodeConfig) => {
            const tierBadge =
              c.defaultTier === 3
                ? '[T3 🛑 NOW]'
                : c.defaultTier === 2
                ? '[T2 ⚠️ SHIFT]'
                : '[T1 ℹ️ MON]';

            return (
              <div key={c.id} className="flex items-baseline gap-1">
                <span className="font-mono font-bold text-[9px]">{tierBadge}</span>
                <span className="font-bold">{c.letter} ({c.shortLabel}):</span>
                <span className="text-gray-700 truncate">{c.plainLanguageDescription}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paper Handoff Table */}
      <table className="w-full border-collapse border border-black text-xs mb-4">
        <thead>
          <tr className="bg-gray-200 border-b border-black text-left">
            <th className="border border-black p-2 w-32">Room / Resident</th>
            <th className="border border-black p-2 min-w-[180px]">Done (Care completed)</th>
            <th className="border border-black p-2 min-w-[180px]">Not Done / Next Shift</th>
            <th className="border border-black p-2 min-w-[180px]">Changes (Code + Note)</th>
            <th className="border border-black p-2 w-28 text-center">Told Nurse?</th>
          </tr>
        </thead>
        <tbody>
          {(isBlank
            ? [
                { room: '101', residentName: 'Mrs. A' },
                { room: '102', residentName: 'Mr. B' },
                { room: '103', residentName: 'Mrs. C' },
                { room: '104', residentName: 'Mr. D' },
                { room: '105', residentName: 'Mrs. E' },
                { room: '106', residentName: 'Mr. F' },
                { room: '107', residentName: 'Resident G' },
                { room: '108', residentName: 'Resident H' },
              ]
            : rows
          ).map((r: any) => {
            const codes = r.changeCodes?.value || [];
            const codeDisplay = codes.length > 0 ? codes.map(formatCodeChip).join(', ') : '';

            return (
              <tr key={r.room} className="border-b border-black h-16 align-top">
                <td className="border border-black p-2 font-bold">
                  {r.room} – {r.residentName}
                </td>
                <td className="border border-black p-2">
                  {isBlank ? '' : r.done?.value || ''}
                </td>
                <td className="border border-black p-2">
                  {isBlank ? '' : r.notDoneNextShift?.value || ''}
                </td>
                <td className="border border-black p-2">
                  {isBlank ? (
                    ''
                  ) : (
                    <div>
                      {codeDisplay && (
                        <div className="font-bold text-[10px] mb-0.5">{codeDisplay}</div>
                      )}
                      <div>{r.changeNote?.value || ''}</div>
                    </div>
                  )}
                </td>
                <td className="border border-black p-2 text-center align-middle">
                  {isBlank
                    ? '[ ] RN: ____'
                    : r.toldNurse?.value
                    ? `[✓] ${r.nurseInitials?.value || 'RN'}`
                    : '[ ] —'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Anything else */}
      <div className="border border-black p-3 min-h-[60px] text-xs">
        <div className="font-bold uppercase tracking-wider mb-1">
          Anything Else for the Next Shift:
        </div>
        <div className="text-gray-800">
          {isBlank ? '____________________________________________________________________________________' : anythingElse}
        </div>
      </div>

      {/* Decision Support & Clinical Protocol Disclaimer */}
      <div className="mt-3 text-[10px] text-gray-600 space-y-0.5">
        <div>
          * <strong>Clinical Notice:</strong> All alerts and tiers are decision support only. The charge nurse makes all clinical decisions.
        </div>
        <div>
          Severity tiers are a prototype proposal and must be reviewed and approved by Schlegel Villages nursing leadership. They are not part of the official INTERACT tool.
        </div>
      </div>

      {/* Footer Signatures */}
      <div className="mt-6 pt-3 border-t border-black grid grid-cols-3 gap-6 text-xs">
        <div>
          Outgoing Staff Signature: _______________________
        </div>
        <div>
          Incoming Staff Signature: _______________________
        </div>
        <div>
          Charge Nurse Verification: _______________________
        </div>
      </div>
    </div>
  );
};

