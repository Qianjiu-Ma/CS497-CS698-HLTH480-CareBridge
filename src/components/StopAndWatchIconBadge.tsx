import React, { useState } from 'react';
import {
  Eye,
  MessageSquareOff,
  HandHelping,
  HeartPulse,
  UtensilsCrossed,
  Timer,
  Droplets,
  Scale,
  Flame,
  Bed,
  Bandage,
  Footprints,
  Info,
  X,
  Volume2,
  AlertTriangle,
  OctagonAlert,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  getCodeConfig,
  SeverityTier,
  TIER_METADATA,
  STOP_AND_WATCH_CONFIG,
  getTranslatedStopAndWatchLabel,
  mapStopAndWatchTextToCodeId,
} from '../data/stopAndWatchCodes';

/**
 * Returns a clear, intuitive clinical icon for each Stop & Watch code.
 * Highly accessible for staff regardless of language or literacy level.
 */
export function getStopAndWatchIcon(codeId: string) {
  switch (codeId) {
    case 'S':
      return Eye; // Seems different than usual
    case 'T_talks':
      return MessageSquareOff; // Talks or communicates less
    case 'O':
      return HandHelping; // Overall needs more help
    case 'P':
      return HeartPulse; // Pain (new or worse)
    case 'A_ate':
      return UtensilsCrossed; // Ate less
    case 'N':
      return Timer; // No bowel movement in 3 days, or diarrhea
    case 'D':
      return Droplets; // Drank less / fluids
    case 'W':
      return Scale; // Weight change
    case 'A_agitated':
      return Flame; // Agitated or nervous
    case 'T_tired':
      return Bed; // Tired, weak, drowsy, confused
    case 'C':
      return Bandage; // Skin change / pressure redness / wound
    case 'H':
      return Footprints; // Help with walking, transferring
    default:
      return Info;
  }
}

/**
 * Maps raw textual phrases or exact schema enum labels to internal code IDs.
 */
export function findCodeIdFromFlagText(text: string): string | null {
  return mapStopAndWatchTextToCodeId(text);
}

interface StopAndWatchIconBadgeProps {
  codeId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showLetterPrefix?: boolean;
  iconOnly?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  customTiers?: Record<string, SeverityTier>;
  interactive?: boolean;
  language?: string;
}

export const StopAndWatchIconBadge: React.FC<StopAndWatchIconBadgeProps> = ({
  codeId,
  size = 'md',
  showLabel = true,
  showLetterPrefix = false,
  iconOnly = false,
  onRemove,
  onClick,
  customTiers,
  interactive = true,
  language = 'en',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const config = getCodeConfig(codeId, customTiers);
  const IconComponent = getStopAndWatchIcon(codeId);
  const tier = config?.defaultTier || 1;
  const tierMeta = TIER_METADATA[tier];

  const iconSizeClass =
    size === 'xs'
      ? 'w-2.5 h-2.5'
      : size === 'sm'
      ? 'w-3 h-3'
      : size === 'lg'
      ? 'w-4 h-4'
      : 'w-3.5 h-3.5';

  const textClass =
    size === 'xs'
      ? 'text-[9px]'
      : size === 'sm'
      ? 'text-[10px]'
      : size === 'lg'
      ? 'text-xs'
      : 'text-[11px]';

  const paddingClass = iconOnly
    ? size === 'xs'
      ? 'p-0.5'
      : size === 'sm'
      ? 'p-1'
      : size === 'lg'
      ? 'p-2'
      : 'p-1.5'
    : size === 'xs'
    ? 'px-1.5 py-0.5 gap-1'
    : size === 'sm'
    ? 'px-1.5 py-0.5 gap-1'
    : size === 'lg'
    ? 'px-2.5 py-1 gap-2'
    : 'px-2 py-0.5 gap-1.5';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (interactive) {
      setIsModalOpen(true);
    }
  };

  const plainTitle = `${config?.plainLabel || config?.shortLabel || codeId} (${tierMeta.heading}): ${config?.plainLanguageDescription || ''}`;

  return (
    <>
      <span
        onClick={handleClick}
        className={`inline-flex items-center rounded-md font-semibold border transition-colors shadow-2xs select-none ${
          tierMeta.badgeBg
        } ${tierMeta.badgeColor} ${tierMeta.badgeBorder} ${paddingClass} ${textClass} ${
          interactive ? 'hover:brightness-95 hover:shadow-xs cursor-pointer' : ''
        }`}
        title={plainTitle}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
      >
        <IconComponent className={`${iconSizeClass} shrink-0 opacity-95`} aria-hidden="true" />
        {!iconOnly && showLabel && (
          <span className="truncate max-w-[160px] tracking-tight">
            {showLetterPrefix && config?.letter ? `${config.letter}: ` : ''}
            {getTranslatedStopAndWatchLabel(codeId, language, config?.plainLabel || config?.shortLabel)}
          </span>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hover:bg-black/10 rounded-full p-0.5 cursor-pointer ml-0.5 -mr-0.5"
            title="Remove flag"
            aria-label={`Remove ${config?.plainLabel || codeId}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </span>

      {/* Accessible Detail Popover / Modal when clicked */}
      {isModalOpen && config && (
        <StopAndWatchDetailModal
          config={config}
          tierMeta={tierMeta}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};

interface StopAndWatchDetailModalProps {
  config: ReturnType<typeof getCodeConfig> & object;
  tierMeta: typeof TIER_METADATA[SeverityTier];
  onClose: () => void;
}

export const StopAndWatchDetailModal: React.FC<StopAndWatchDetailModalProps> = ({
  config,
  tierMeta,
  onClose,
}) => {
  const IconComponent = getStopAndWatchIcon(config.id);

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const textToRead = `${config.plainLabel}. ${config.plainLanguageDescription}. Required action: ${tierMeta.actionSummary}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-start justify-between gap-3 ${tierMeta.badgeBg} ${tierMeta.badgeBorder}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-200/80 text-slate-800">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-white/80 px-1.5 py-0.2 rounded border border-slate-300">
                  Code {config.letter}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${tierMeta.badgeClass}`}>
                  {tierMeta.name}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {config.plainLabel || config.label}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSpeak}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer transition-colors"
              title="Listen to explanation"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3.5 text-xs">
          <div>
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
              What to look for:
            </span>
            <p className="text-slate-900 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              {config.plainLanguageDescription}
            </p>
          </div>

          <div>
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
              Example care observation:
            </span>
            <p className="text-slate-700 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              {config.examplePhrase}
            </p>
          </div>

          <div>
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
              Required Clinical Action:
            </span>
            <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${tierMeta.badgeBg} ${tierMeta.badgeBorder}`}>
              {tierMeta.tier === 3 ? (
                <OctagonAlert className="w-4 h-4 text-purple-900 shrink-0 mt-0.5" />
              ) : tierMeta.tier === 2 ? (
                <AlertTriangle className="w-4 h-4 text-amber-900 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-sky-900 shrink-0 mt-0.5" />
              )}
              <div className="text-slate-900 leading-snug">
                {tierMeta.actionSummary}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Tap anywhere to close · INTERACT™ Early Warning
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
