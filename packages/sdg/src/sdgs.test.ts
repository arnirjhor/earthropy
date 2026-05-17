import { describe, expect, it } from 'vitest';
import { getSdgByCode, getSdgById, isSdgId } from './sdgs.ts';

describe('getSdgById', () => {
  it('returns the Climate Action row for id 13', () => {
    const sdg = getSdgById(13);
    expect(sdg.code).toBe('climate-action');
    expect(sdg.color).toBe('#3F7E44');
    expect(sdg.id).toBe(13);
  });
});

describe('getSdgByCode', () => {
  it('returns id 17 for partnerships-for-the-goals', () => {
    const sdg = getSdgByCode('partnerships-for-the-goals');
    expect(sdg.id).toBe(17);
  });
});

describe('isSdgId', () => {
  it('returns false for 18', () => {
    expect(isSdgId(18)).toBe(false);
  });

  it('returns true for 1', () => {
    expect(isSdgId(1)).toBe(true);
  });
});
