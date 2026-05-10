import { describe, it, expect } from 'vitest';
import { fmtUsd, fmtPct, fmtCount, fmtAgo, driftBucket } from '@/lib/format';

describe('format helpers', () => {
  describe('fmtUsd', () => {
    it('returns em-dash for null/undefined/NaN', () => {
      expect(fmtUsd(null)).toBe('—');
      expect(fmtUsd(undefined)).toBe('—');
      expect(fmtUsd(NaN)).toBe('—');
    });
    it('signs only when sign:true and value > 0', () => {
      expect(fmtUsd(1.23)).toBe('$1.23');
      expect(fmtUsd(1.23, { sign: true })).toBe('+$1.23');
      expect(fmtUsd(-1.23, { sign: true })).toBe('-$1.23');
    });
    it('uses fewer decimals as magnitude grows', () => {
      expect(fmtUsd(0.0042)).toBe('$0.0042');
      expect(fmtUsd(1.234)).toBe('$1.23');
      expect(fmtUsd(12_345)).toBe('$12345.0');
      expect(fmtUsd(1_234_567)).toBe('$1234567');
    });
  });

  describe('fmtPct', () => {
    it('handles null', () => {
      expect(fmtPct(null)).toBe('—');
    });
    it('formats with default 1 decimal', () => {
      expect(fmtPct(12.345)).toBe('12.3%');
    });
    it('signs only with opt', () => {
      expect(fmtPct(12.34, 1, { sign: true })).toBe('+12.3%');
      expect(fmtPct(-12.34, 1, { sign: true })).toBe('-12.3%');
    });
  });

  describe('fmtCount', () => {
    it('compact format above 1k/1M', () => {
      expect(fmtCount(999)).toBe('999');
      expect(fmtCount(1_500)).toBe('1.5k');
      expect(fmtCount(1_500_000)).toBe('1.5M');
    });
  });

  describe('fmtAgo', () => {
    it('returns em-dash on null', () => {
      expect(fmtAgo(null)).toBe('—');
    });
    it('seconds / minutes / hours / days', () => {
      const now = 1_700_000_000_000;
      expect(fmtAgo(now - 5_000, now)).toBe('5s ago');
      expect(fmtAgo(now - 90_000, now)).toBe('1m ago');
      expect(fmtAgo(now - 3_600_000 * 3, now)).toBe('3h ago');
      expect(fmtAgo(now - 86_400_000 * 2, now)).toBe('2d ago');
    });
    it('clamps negative deltas to 0s', () => {
      const now = 1_700_000_000_000;
      expect(fmtAgo(now + 5_000, now)).toBe('0s ago');
    });
  });

  describe('driftBucket', () => {
    it('green under 10%', () => {
      expect(driftBucket(0)).toBe('green');
      expect(driftBucket(9.9)).toBe('green');
      expect(driftBucket(-9.9)).toBe('green');
    });
    it('yellow 10-30%', () => {
      expect(driftBucket(10)).toBe('yellow');
      expect(driftBucket(29.9)).toBe('yellow');
      expect(driftBucket(-15)).toBe('yellow');
    });
    it('red >= 30%', () => {
      expect(driftBucket(30)).toBe('red');
      expect(driftBucket(150)).toBe('red');
      expect(driftBucket(-30)).toBe('red');
    });
  });
});
