export * from './stopAndWatchCodes';
import {
  STOP_AND_WATCH_CONFIG,
  getCodeConfig,
  formatCodeChip,
  formatCodeDisplay,
  StopAndWatchCodeConfig,
} from './stopAndWatchCodes';

export const STOP_AND_WATCH_CODES = STOP_AND_WATCH_CONFIG;
export const getCodeById = getCodeConfig;
export { formatCodeChip, formatCodeDisplay };
export type { StopAndWatchCodeConfig as StopAndWatchCode };
