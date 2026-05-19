export type { Sdg, SdgCode, SdgId } from './types.ts';
export { SDGS, getSdgById, getSdgByCode, isSdgCode, isSdgId } from './sdgs.ts';
export type { SdgIndicator } from './indicators.ts';
export {
  INDICATORS,
  getIndicatorByCode,
  getIndicatorById,
  getIndicatorsBySdgId,
} from './indicators.ts';
