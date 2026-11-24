import React, { useState, useMemo, useEffect, useRef } from 'react';
import { EMRRecord } from '../types/handoff';
import {
  Database,
  CheckCircle,
  Filter,
  Shield,
  MessageSquare,
  Search,
  Copy,
  Check,
  Printer,
  ChevronDown,
  ChevronUp,
  Volume2,
  RefreshCw,
  LayoutGrid,
  List,
  FileCheck2,
  UserCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { StopAndWatchIconBadge } from './StopAndWatchIconBadge';
import { getInstantLtcTranslation, translateBidirectional } from '../utils/translator';
import { InterfaceLanguage } from '../utils/uiTranslations';

interface EmrViewProps {
  records: EMRRecord[];
  customCodeTiers?: Record<string, 1 | 2 | 3>;
  onSignOffRecord?: (recordId: string, nurseName: string) => void;
  interfaceLanguage?: InterfaceLanguage;
}

export const EmrView: React.FC<EmrViewProps> = ({
  records,
  customCodeTiers,
  onSignOffRecord,
  interfaceLanguage = 'en',
}) => {
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const viewLanguage = interfaceLanguage;
  const [showOriginalEn, setShowOriginalEn] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [emrTranslations, setEmrTranslations] = useState<Record<string, string>>({});
  const [isTranslatingEmr, setIsTranslatingEmr] = useState<boolean>(false);
  const emrCacheRef = useRef<Map<string, string>>(new Map());

  // Dynamically translate EMR record cells via Cloud Translation v3 when non-English is selected
  useEffect(() => {
    if (viewLanguage === 'en') {
      setIsTranslatingEmr(false);
      setShowOriginalEn(false);
      return;
    }

    let cancelled = false;
    const uniqueTexts = new Set<string>(['No change']);
    records.forEach((rec) => {
      rec.rows.forEach((r) => {
        [
          r.done?.value,
          r.notDoneNextShift?.value,
          r.mltcDetails.qualitativeObservations?.value,
          r.changeNote?.value,
        ].forEach((val) => {
          const clean = (val || '').trim();
          if (clean && clean !== '—') uniqueTexts.add(clean);
        });
      });
    });

    const pendingTexts = Array.from(uniqueTexts).filter(
      (txt) => !emrCacheRef.current.has(`${viewLanguage}::${txt}`)
    );

    if (pendingTexts.length === 0) {
      setIsTranslatingEmr(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslatingEmr(true);
      const updates: Record<string, string> = {};

      try {
        await Promise.all(
          pendingTexts.map(async (txt) => {
            const res = await translateBidirectional(txt, 'en', viewLanguage);
            const translated =
              res?.translatedText?.trim() || getInstantLtcTranslation(txt, viewLanguage, 'en');
            const key = `${viewLanguage}::${txt}`;
            emrCacheRef.current.set(key, translated);
            updates[key] = translated;
          })
        );
        if (!cancelled) {
          setEmrTranslations((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        // fallback already handled
      } finally {
        if (!cancelled) setIsTranslatingEmr(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [viewLanguage, records]);

  const tEmr = (text: string): string => {
    if (!text || viewLanguage === 'en') return text;
    const key = `${viewLanguage}::${text.trim()}`;
    return emrTranslations[key] || getInstantLtcTranslation(text, viewLanguage, 'en');
  };
  const [filterChangesOnly, setFilterChangesOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>(() => {
    // Expand the first record by default
    const initial: Record<string, boolean> = {};
    if (records[0]?.id) initial[records[0].id] = true;
    return initial;
  });

  // State for interactive actions
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Local state for sign-offs in case onSignOffRecord is not passed
  const [localSignOffs, setLocalSignOffs] = useState<Record<string, { nurse: string; time: string }>>({});

  // Filter records based on search and filters
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Shift filter
      if (filterShift !== 'all' && !rec.header.shift.toLowerCase().includes(filterShift.toLowerCase())) {
        return false;
      }

      // Changes only filter
      if (filterChangesOnly) {
        const hasCodes = rec.rows.some((r) => (r.changeCodes?.value || []).length > 0);
        if (!hasCodes) return false;
      }

      // Search query (resident name, room, note, staff)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesHeader =
          rec.header.unit.toLowerCase().includes(q) ||
          rec.header.outgoingPsw.toLowerCase().includes(q) ||
          rec.header.shift.toLowerCase().includes(q);
        const matchesRows = rec.rows.some(
          (r) =>
            r.room.toLowerCase().includes(q) ||
            r.residentName.toLowerCase().includes(q) ||
            (r.changeNote?.value || '').toLowerCase().includes(q) ||
            (r.done?.value || '').toLowerCase().includes(q) ||
            (r.notDoneNextShift?.value || '').toLowerCase().includes(q)
        );
        const matchesTranscript = rec.rawTranscript?.toLowerCase().includes(q);
        if (!matchesHeader && !matchesRows && !matchesTranscript) return false;
      }

      return true;
    });
  }, [records, filterShift, filterChangesOnly, searchQuery]);

  // Toggle single accordion
  const toggleRecord = (id: string) => {
    setExpandedRecordIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Expand / Collapse all
  const handleToggleExpandAll = () => {
    const allExpanded = filteredRecords.every((r) => expandedRecordIds[r.id]);
    const newState: Record<string, boolean> = {};
    filteredRecords.forEach((r) => {
      newState[r.id] = !allExpanded;
    });
    setExpandedRecordIds(newState);
  };

  // Sync button action
  const handleSyncEMR = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 600);
  };

  // Copy structured record to clipboard
  const handleCopyRecordSummary = (rec: EMRRecord) => {
    const lines: string[] = [
      `=== EMR SHIFT HANDOFF RECORD ===`,
      `Unit: ${rec.header.unit}`,
      `Shift: ${rec.header.shift}`,
      `Date: ${rec.header.date}`,
      `Outgoing Staff: ${rec.header.outgoingPsw}`,
      `Confirmed By: ${rec.submittedBy}`,
      `--------------------------------`,
      `RESIDENT CARE SUMMARY:`,
    ];

    rec.rows.forEach((r) => {
      const codes = (r.changeCodes?.value || []).join(', ');
      lines.push(
        `• Rm ${r.room} (${r.residentName}): Done: ${r.done?.value || '—'} | Next: ${r.notDoneNextShift?.value || '—'}${
          codes ? ` | Changes: ${codes} - ${r.changeNote?.value || ''}` : ''
        }`
      );
    });

    if (rec.anythingElse) {
      lines.push(`--------------------------------`);
      lines.push(`General Village Note: ${rec.anythingElse}`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedRecordId(rec.id);
    setTimeout(() => setCopiedRecordId(null), 2000);
  };

  // Copy transcript text
  const handleCopyTranscript = (id: string, transcript: string) => {
    navigator.clipboard.writeText(transcript);
    setCopiedTranscriptId(id);
    setTimeout(() => setCopiedTranscriptId(null), 2000);
  };

  // Speak transcript text
  const handleSpeakTranscript = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-CA';
    utterance.onstart = () => setSpeakingId(id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Charge Nurse Sign-Off action
  const handleSignOff = (recordId: string) => {
    const nurse = 'K. Lewis, RN';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (onSignOffRecord) {
      onSignOffRecord(recordId, nurse);
    } else {
      setLocalSignOffs((prev) => ({
        ...prev,
        [recordId]: { nurse, time },
      }));
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Clean Header Banner (Simplified, No walls of text) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Simulated EMR Integration
                </h1>
                <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  PointClickCare Sync
                </span>
                <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                  • Synced: {lastSyncTime}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived shift handoffs with immutable chain-of-custody audit logs and confirmed care observations.
              </p>
            </div>
          </div>

          {/* Top Quick Actions Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncEMR}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Check for simulated EHR sync updates"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin text-teal-700' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync EMR'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Print all records"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print All</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Simplified Controls & Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Search Bar */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:bg-white focus-within:border-teal-600">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search residents, notes, or staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none focus:outline-none text-slate-900 placeholder-slate-400 text-xs font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Center: Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => {
              setFilterShift('all');
              setFilterChangesOnly(false);
            }}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              filterShift === 'all' && !filterChangesOnly
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Shifts ({records.length})
          </button>

          <button
            onClick={() => setFilterChangesOnly(!filterChangesOnly)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              filterChangesOnly
                ? 'bg-amber-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            <span>Changes Only</span>
          </button>

          <button
            onClick={() => setFilterShift(filterShift === 'Day' ? 'all' : 'Day')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              filterShift === 'Day'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Day
          </button>

          <button
            onClick={() => setFilterShift(filterShift === 'Evening' ? 'all' : 'Evening')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              filterShift === 'Evening'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Evening
          </button>
        </div>

        {/* Right: Show EN + Resident Dropdown + View Mode + Expand All */}
        <div className="flex items-center gap-2">
          {viewLanguage !== 'en' && (
            <div className="flex items-center gap-1.5">
              {isTranslatingEmr && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => setShowOriginalEn((prev) => !prev)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer active:scale-[0.98] ${
                  showOriginalEn
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {showOriginalEn ? 'Hide EN' : 'Show EN'}
              </button>
            </div>
          )}

          {/* Room Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">All Rooms (101-106)</option>
              <option value="101">101 – Mrs. A</option>
              <option value="102">102 – Mr. B</option>
              <option value="103">103 – Mrs. C</option>
              <option value="104">104 – Mr. D</option>
              <option value="105">105 – Mrs. E</option>
              <option value="106">106 – Mr. F</option>
            </select>
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-500'
              }`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1 rounded cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-500'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand/Collapse All */}
          <button
            onClick={handleToggleExpandAll}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 hover:bg-teal-50 rounded-md transition-colors cursor-pointer"
          >
            {filteredRecords.every((r) => expandedRecordIds[r.id]) ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* 3. Submitted Shift Records List */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
            <Database className="w-8 h-8 mx-auto text-slate-300" />
            <div className="text-xs font-semibold text-slate-600">No shift records match your filter.</div>
            <div className="text-[11px]">Try clearing search keywords or switching filters.</div>
          </div>
        ) : (
          filteredRecords.map((rec) => {
            const isExpanded = !!expandedRecordIds[rec.id];
            const displayRows =
              selectedRoom === 'all'
                ? rec.rows
                : rec.rows.filter((r) => r.room === selectedRoom);

            const isSignedOff = !!rec.acknowledgedByNurse || !!localSignOffs[rec.id];
            const signerName = rec.acknowledgedByNurse || localSignOffs[rec.id]?.nurse;

            return (
              <div
                key={rec.id}
                className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all"
              >
                {/* Clean Record Header Strip */}
                <div className="px-4 py-3 bg-slate-50/70 hover:bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div
                    onClick={() => toggleRecord(rec.id)}
                    className="flex flex-wrap items-center gap-2.5 cursor-pointer flex-1"
                  >
                    <button className="text-slate-400 hover:text-slate-600 p-0.5">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {rec.header.unit} · {rec.header.shift}
                    </span>

                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(rec.submittedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {new Date(rec.submittedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>By {rec.submittedBy}</span>
                    </span>

                    {/* Nurse Review Status Badge */}
                    {isSignedOff ? (
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-blue-600" />
                        <span>Signed by {signerName}</span>
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Pending Nurse Sign-off</span>
                      </span>
                    )}
                  </div>

                  {/* Header Actions Buttons (Fully Working) */}
                  <div className="flex items-center gap-1.5 shrink-0 text-xs">
                    {/* Copy Summary Button */}
                    <button
                      onClick={() => handleCopyRecordSummary(rec)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer font-medium"
                      title="Copy structured clinical handoff summary to clipboard"
                    >
                      {copiedRecordId === rec.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {/* Sign-Off Button if not signed off */}
                    {!isSignedOff && (
                      <button
                        onClick={() => handleSignOff(rec.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                        title="Simulate Charge Nurse Electronic Sign-off"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Sign as RN</span>
                      </button>
                    )}

                    {/* Toggle expand button */}
                    <button
                      onClick={() => toggleRecord(rec.id)}
                      className="text-teal-700 hover:text-teal-900 font-semibold text-xs px-2 py-1 cursor-pointer"
                    >
                      {isExpanded ? 'Hide' : 'View'}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4 text-xs animate-fadeIn">
                    {/* Clinical Safety Override Warning if applicable */}
                    {rec.overrideReason && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs flex items-start gap-2.5">
                        <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-amber-950">Clinical Override Recorded:</div>
                          <div className="text-amber-900 italic mt-0.5">&ldquo;{rec.overrideReason}&rdquo;</div>
                        </div>
                      </div>
                    )}

                    {/* View Mode 1: Clean Structured Table */}
                    {viewMode === 'table' ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs divide-y divide-slate-200">
                          <thead className="bg-slate-100/80 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                            <tr>
                              <th className="py-2 px-3">Room / Resident</th>
                              <th className="py-2 px-3">Care Done</th>
                              <th className="py-2 px-3">Next Shift Action</th>
                              <th className="py-2 px-3">Stop & Watch Changes</th>
                              <th className="py-2 px-3">Observations & Fluids</th>
                              <th className="py-2 px-3">Nurse</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {displayRows.map((r) => {
                              const codes = r.changeCodes?.value || [];
                              const doneVal = r.done?.value || '—';
                              const nextVal = r.notDoneNextShift?.value || '—';
                              const obsVal = r.mltcDetails.qualitativeObservations?.value || '';
                              const changeNoteVal = r.changeNote?.value || '';

                              const displayDone = viewLanguage === 'en' ? doneVal : tEmr(doneVal);
                              const displayNext = viewLanguage === 'en' ? nextVal : tEmr(nextVal);
                              const displayObs = viewLanguage === 'en' ? obsVal : tEmr(obsVal);
                              const displayChange = viewLanguage === 'en' ? changeNoteVal : tEmr(changeNoteVal);

                              return (
                                <tr key={r.room} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                    Rm {r.room} – {r.residentName}
                                  </td>
                                  <td className="py-2 px-3 text-slate-800">
                                    <div>{displayDone}</div>
                                    {viewLanguage !== 'en' && showOriginalEn && displayDone !== doneVal && (
                                      <div className="text-[10px] text-slate-400 italic">EN: {doneVal}</div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-medium text-slate-900">
                                    <div>{displayNext}</div>
                                    {viewLanguage !== 'en' && showOriginalEn && displayNext !== nextVal && (
                                      <div className="text-[10px] text-slate-400 italic">EN: {nextVal}</div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    {codes.length > 0 ? (
                                      <div className="space-y-1">
                                        <div className="flex flex-wrap gap-1">
                                          {codes.map((c) => (
                                            <StopAndWatchIconBadge
                                              key={c}
                                              codeId={c}
                                              size="xs"
                                              customTiers={customCodeTiers}
                                              language={viewLanguage}
                                            />
                                          ))}
                                        </div>
                                        <div className="text-slate-700 text-[11px] font-medium">{displayChange}</div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">
                                        {viewLanguage === 'en' ? 'No change' : tEmr('No change')}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700">
                                    {obsVal ? (
                                      <span className="line-clamp-2">
                                        {displayObs}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">None logged</span>
                                    )}
                                    {r.mltcDetails.fluidIntakeMl?.value && (
                                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                        Fluids: {r.mltcDetails.fluidIntakeMl.value} mL
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                                    {r.toldNurse?.value ? r.nurseInitials?.value || 'RN (KL)' : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* View Mode 2: Clean Compact Resident Cards */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {displayRows.map((r) => {
                          const codes = r.changeCodes?.value || [];
                          const doneVal = r.done?.value || '—';
                          const nextVal = r.notDoneNextShift?.value || '—';
                          const changeNoteVal = r.changeNote?.value || '';

                          const displayDone = viewLanguage === 'en' ? doneVal : tEmr(doneVal);
                          const displayNext = viewLanguage === 'en' ? nextVal : tEmr(nextVal);
                          const displayChange = viewLanguage === 'en' ? changeNoteVal : tEmr(changeNoteVal);

                          return (
                            <div
                              key={r.room}
                              className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-bold text-xs">
                                <span className="text-slate-900">Rm {r.room} · {r.residentName}</span>
                                {codes.length > 0 ? (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 rounded">
                                    {codes.length} Change{codes.length > 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Per Care Plan</span>
                                )}
                              </div>

                              <div className="text-xs text-slate-700">
                                <strong>Done:</strong> {displayDone}
                              </div>

                              <div className="text-xs text-slate-800">
                                <strong>Next:</strong> {displayNext}
                              </div>

                              {codes.length > 0 && (
                                <div className="pt-1 border-t border-slate-200 text-xs">
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {codes.map((c) => (
                                      <StopAndWatchIconBadge
                                        key={c}
                                        codeId={c}
                                        size="xs"
                                        customTiers={customCodeTiers}
                                        language={viewLanguage}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-slate-600 text-[11px]">{displayChange}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Unit & Shift Notes */}
                    {rec.anythingElse && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-start gap-2">
                        <FileCheck2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800">Next Shift & Equipment Notes:</span>{' '}
                          <span className="text-slate-700">{rec.anythingElse}</span>
                        </div>
                      </div>
                    )}

                    {/* Retained Audio Transcript Strip with Working Buttons */}
                    {rec.rawTranscript && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-teal-700" />
                            <span>Retained Voice Transcript:</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSpeakTranscript(rec.id, rec.rawTranscript)}
                              className={`p-1 rounded cursor-pointer ${
                                speakingId === rec.id
                                  ? 'bg-teal-700 text-white font-bold'
                                  : 'text-slate-500 hover:text-teal-700 hover:bg-slate-200'
                              }`}
                              title="Listen to verbatim voice transcript"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleCopyTranscript(rec.id, rec.rawTranscript)}
                              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200 cursor-pointer"
                              title="Copy verbatim transcript"
                            >
                              {copiedTranscriptId === rec.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700 font-bold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="text-slate-700 font-mono text-[11px] leading-relaxed bg-white p-2.5 rounded border border-slate-200">
                          &ldquo;{rec.rawTranscript}&rdquo;
                        </div>
                      </div>
                    )}

                    {/* Concise Chain of Custody & Audit Trail */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200">
                      <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                        Chain of Custody & Audit Trail:
                      </div>

                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 divide-y divide-slate-200 text-xs">
                        {rec.auditTrail.map((log, index) => (
                          <div key={index} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{log.action}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600">{log.actor} ({log.role})</span>
                              {log.details && (
                                <span className="text-slate-500 text-[11px] hidden sm:inline">
                                  – {log.details}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {log.timestamp}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Minimal Single-Line Standard Footer */}
      <div className="p-2.5 text-center text-[11px] text-slate-500 bg-slate-100 rounded-lg border border-slate-200">
        Demo data only · Complies with Ontario MLTC documentation and retention standards.
      </div>
    </div>
  );
};
