import { describe, expect, it } from 'vitest';
import {
  INDICATORS,
  getIndicatorByCode,
  getIndicatorById,
  getIndicatorsBySdgId,
} from './indicators.ts';

describe('INDICATORS', () => {
  it('has exactly 34 entries', () => {
    expect(INDICATORS.length).toBe(34);
  });

  it('covers all 17 SDGs', () => {
    const sdgIds = new Set(INDICATORS.map((i) => i.sdgId));
    expect(sdgIds.size).toBe(17);
    for (let id = 1; id <= 17; id++) {
      expect(sdgIds.has(id as 1)).toBe(true);
    }
  });

  it('has unique codes', () => {
    const codes = INDICATORS.map((i) => i.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('has unique ids', () => {
    const ids = INDICATORS.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getIndicatorById', () => {
  it('returns the correct indicator for sdg-15-2-1', () => {
    const indicator = getIndicatorById('sdg-15-2-1');
    expect(indicator.code).toBe('15.2.1');
    expect(indicator.sdgId).toBe(15);
  });

  it('throws for unknown id', () => {
    expect(() => getIndicatorById('does-not-exist')).toThrow('Unknown indicator id');
  });
});

describe('getIndicatorByCode', () => {
  it('returns indicator for code 13.2.2', () => {
    const indicator = getIndicatorByCode('13.2.2');
    expect(indicator.id).toBe('sdg-13-2-2');
    expect(indicator.sdgId).toBe(13);
  });

  it('throws for unknown code', () => {
    expect(() => getIndicatorByCode('99.9.9')).toThrow('Unknown indicator code');
  });
});

describe('getIndicatorsBySdgId', () => {
  it('returns 2 indicators for SDG 15', () => {
    const indicators = getIndicatorsBySdgId(15);
    expect(indicators.length).toBe(2);
    expect(indicators.map((i) => i.code).sort()).toEqual(['15.1.1', '15.2.1']);
  });

  it('returns empty array for unknown SDG id', () => {
    // @ts-expect-error testing invalid input
    const indicators = getIndicatorsBySdgId(99);
    expect(indicators).toEqual([]);
  });
});
