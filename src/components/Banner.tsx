import { l10n } from '../utils/localization';
export const PrototypeBanner = () => (
  <div className="cb-banner no-print">
    <div className="cb-wrap">
      <span>{l10n("Prototype · Demo data only")}</span>
      <span className="cb-verification-banner">{l10n("Human verification required before EMR submission")}</span>
    </div>
  </div>
);
