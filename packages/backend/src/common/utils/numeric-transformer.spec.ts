import { numericTransformer } from './numeric-transformer';

describe('numericTransformer', () => {
  describe('to (write side)', () => {
    it('passes through numbers unchanged', () => {
      expect(numericTransformer.to(0)).toBe(0);
      expect(numericTransformer.to(123.45)).toBe(123.45);
      expect(numericTransformer.to(-0.0001)).toBe(-0.0001);
    });

    it('passes through null and undefined unchanged', () => {
      expect(numericTransformer.to(null)).toBeNull();
      expect(numericTransformer.to(undefined)).toBeUndefined();
    });
  });

  describe('from (read side)', () => {
    it('returns null for null and undefined', () => {
      expect(numericTransformer.from(null)).toBeNull();
      expect(numericTransformer.from(undefined)).toBeNull();
    });

    it('returns the value unchanged when it is already a number', () => {
      expect(numericTransformer.from(123)).toBe(123);
      expect(numericTransformer.from(0)).toBe(0);
    });

    it('parses a numeric string into a number', () => {
      // The pg driver returns NUMERIC/DECIMAL columns as strings; the read-side
      // transformer is what fixes that for the rest of the app.
      expect(numericTransformer.from('0.0001')).toBe(0.0001);
      expect(numericTransformer.from('42')).toBe(42);
      expect(numericTransformer.from('-1.5')).toBe(-1.5);
    });

    it('returns null for non-finite parses', () => {
      // parseFloat('not-a-number') is NaN, parseFloat('NaN') is NaN, and
      // parseFloat('Infinity') is Infinity — all rejected by Number.isFinite.
      expect(numericTransformer.from('not-a-number')).toBeNull();
      expect(numericTransformer.from('NaN')).toBeNull();
      expect(numericTransformer.from('Infinity')).toBeNull();
      expect(numericTransformer.from('-Infinity')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(numericTransformer.from('')).toBeNull();
    });
  });
});
