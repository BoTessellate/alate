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

  describe('strips HTML tags (April 29 2026 — yamayoga.in regression)', () => {
    // yamayoga's Shopify storefront returns the vendor field with
    // literal HTML: '<span class="custom-fonts">YAMA</span>YOGA'.
    // Their store uses a CSS class for a custom-font swap and it
    // bled into the Shopify JSON. Without HTML stripping, the brand
    // pill on the fit card rendered the raw `<span>` markup.
    it('strips a leading <span> wrapper', () => {
      expect(
        sanitize('<span class="custom-fonts">YAMA</span>YOGA')
      ).toBe('YAMAYOGA');
    });

    it('strips multiple nested tags', () => {
      expect(
        sanitize('<div><b>HOT</b> <i>BRAND</i></div>')
      ).toBe('HOT BRAND');
    });

    it('strips self-closing tags (<br/>)', () => {
      expect(sanitize('Brand<br/>Name')).toBe('Brand Name');
    });

    it('decodes the most common HTML entities', () => {
      expect(sanitize('Mark&nbsp;&amp;&nbsp;Spencer')).toBe('Mark & Spencer');
    });

    it('returns undefined for input that is only HTML', () => {
      expect(sanitize('<span></span>')).toBeUndefined();
    });

    it('leaves plain text unchanged', () => {
      expect(sanitize('Reistor')).toBe('Reistor');
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
