import { sanitize } from '../utils/sanitize';

describe('sanitize', () => {
  describe('filters garbage tokens the scraper returns', () => {
    it('strips a single "undefined" token', () => {
      expect(sanitize('undefined')).toBeUndefined();
    });

    it('strips the double "undefined undefined" case (the recurring bug)', () => {
      expect(sanitize('undefined undefined')).toBeUndefined();
    });

    it('strips "null"', () => {
      expect(sanitize('null')).toBeUndefined();
    });

    it('strips mixed "null undefined"', () => {
      expect(sanitize('null undefined')).toBeUndefined();
    });

    it('strips when wrapped in extra whitespace', () => {
      expect(sanitize('  undefined   undefined  ')).toBeUndefined();
    });
  });

  describe('preserves real content', () => {
    it('removes trailing "undefined" from a real brand', () => {
      expect(sanitize('Nike undefined')).toBe('Nike');
    });

    it('removes leading "undefined" from a real brand', () => {
      expect(sanitize('undefined Nike')).toBe('Nike');
    });

    it('leaves a clean brand alone', () => {
      expect(sanitize('Nike Air Max')).toBe('Nike Air Max');
    });

    it('does NOT filter capitalised "Undefined" (a real word might contain it)', () => {
      expect(sanitize('Undefined')).toBe('Undefined');
      expect(sanitize('UNDEFINED')).toBe('UNDEFINED');
    });

    it('does not filter unrelated words that merely contain the substring', () => {
      expect(sanitize('Underfine')).toBe('Underfine');
      expect(sanitize('undefinedly')).toBe('undefinedly');
    });
  });

  describe('nullish / empty input', () => {
    it('returns undefined for undefined', () => {
      expect(sanitize(undefined)).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(sanitize(null)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(sanitize('')).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
      expect(sanitize('   ')).toBeUndefined();
    });
  });
});
