
import { Globe } from 'lucide-react';
import { TOP_LANGUAGES } from '../data/languages';
import { interfaceLocale, l10n, type InterfaceLanguage } from '../utils/localization';
import { SelectPopover } from './SelectPopover';

const options = TOP_LANGUAGES.map(({ code, nativeName }) => ({ value: code, label: nativeName, lang: code }));

export function LanguagePicker({ language, onChange }: {
  language: InterfaceLanguage;
  onChange: (language: InterfaceLanguage) => void;
}) {
  return (
    <SelectPopover className="cb-language" label={l10n('Global reading language')} value={language}
      displayValue={language.toUpperCase()} icon={<Globe aria-hidden="true" />} notifyOnReselect
      options={options} onChange={(code) => onChange(interfaceLocale(code))} />
  );
}
