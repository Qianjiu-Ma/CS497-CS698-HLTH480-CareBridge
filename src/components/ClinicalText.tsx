import { useState } from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { l10n, useInterfaceLanguage } from '../utils/localization';
import { speechLocaleFor, translateBidirectional, TranslationResponse } from '../utils/translator';

// A preview is keyed to the exact source and target. Editing the record or changing
// languages replaces the UI instance, even if a previous request is still running.
export function ClinicalText({ text, source = 'auto', target, previewOnly = false }: {
  text: string;
  source?: string;
  target?: string;
  previewOnly?: boolean;
}) {
  const locale = useInterfaceLanguage();
  const language = target || locale;
  if (!text.trim() || text === '—') return previewOnly ? null : <bdi>{text}</bdi>;
  if (source === language) return previewOnly ? null : <bdi lang={source}>{text}</bdi>;
  return <TranslationPreview key={JSON.stringify([text, source, language])}
    text={text} source={source} target={language} previewOnly={previewOnly} />;
}

function TranslationPreview({ text, source, target, previewOnly }: {
  text: string; source: string; target: string; previewOnly: boolean;
}) {
  const [result, setResult] = useState<TranslationResponse>();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const failed = result?.status === 'unavailable';
  const showTranslation = open && result && (result.status === 'machine' || result.status === 'phrase');

  async function toggle() {
    if (open && !failed) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (result && !failed) return;
    setLoading(true);
    setResult(undefined);
    const translation = await translateBidirectional(text, source, target);
    setResult(translation);
    setLoading(false);
  }

  function speak() {
    if (!result) return;
    const language = speechLocaleFor(result.targetLang);
    if (!language) return;
    const utterance = new SpeechSynthesisUtterance(result.translatedText);
    utterance.lang = language;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return <span className="cb-clinical-text">
    {!previewOnly && !showTranslation && <bdi lang={source === 'auto' ? undefined : source}>{text}</bdi>}
    {showTranslation && <bdi lang={result.targetLang}>{result.translatedText}</bdi>}
    {showTranslation && <small className="cb-translation-label" role="status">
      {l10n(result.status === 'phrase' ? 'Phrasebook translation' : 'Machine translation · Verify against the original')}
    </small>}
    <span className="cb-translation-actions">
      <button type="button" className="cb-translation-link" aria-expanded={open} disabled={loading} onClick={toggle}>
        <Languages aria-hidden="true" />
        {l10n(loading ? 'Translating…' : failed ? 'Retry translation' : open ? 'Show original' : 'Translate')}
      </button>
      {showTranslation && 'speechSynthesis' in window && speechLocaleFor(result.targetLang) &&
        <button type="button" className="cb-translation-link" aria-label={l10n('Listen to translation')} onClick={speak}>
          <Volume2 aria-hidden="true" />
        </button>}
    </span>
    {open && failed && <small className="cb-translation-label" role="status">
      {l10n('Translation unavailable. The original text is preserved.')}
    </small>}
    {open && result?.status === 'original' && <small className="cb-translation-label" role="status">
      {l10n('The original is already in this language.')}
    </small>}
  </span>;
}
