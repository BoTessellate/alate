// Test the URL validation logic used in share intent handling

function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

describe('URL Validation', () => {
  describe('valid URLs', () => {
    it('should accept https URLs', () => {
      expect(isValidUrl('https://www.asos.com/product/123')).toBe(true);
      expect(isValidUrl('https://zara.com/us/en/dress-p12345.html')).toBe(true);
    });

    it('should accept http URLs', () => {
      expect(isValidUrl('http://example.com/product')).toBe(true);
    });

    it('should accept URLs with query parameters', () => {
      expect(isValidUrl('https://shop.com/item?id=123&color=blue')).toBe(true);
    });

    it('should accept URLs with fragments', () => {
      expect(isValidUrl('https://shop.com/item#details')).toBe(true);
    });

    it('should accept URLs with ports', () => {
      expect(isValidUrl('https://localhost:3000/product')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('should reject empty strings', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should reject plain text', () => {
      expect(isValidUrl('just some text')).toBe(false);
      expect(isValidUrl('check out this dress')).toBe(false);
    });

    it('should reject URLs without protocol', () => {
      expect(isValidUrl('www.asos.com/product')).toBe(false);
      expect(isValidUrl('asos.com/product')).toBe(false);
    });

    it('should reject non-http protocols', () => {
      expect(isValidUrl('ftp://files.example.com')).toBe(false);
      expect(isValidUrl('mailto:test@example.com')).toBe(false);
      expect(isValidUrl('tel:+1234567890')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
      expect(isValidUrl('://missing-protocol.com')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with special characters', () => {
      expect(isValidUrl('https://shop.com/dress%20blue')).toBe(true);
      expect(isValidUrl('https://shop.com/item?name=blue+dress')).toBe(true);
    });

    it('should handle international domain names', () => {
      expect(isValidUrl('https://例え.jp/product')).toBe(true);
    });

    it('should handle very long URLs', () => {
      const longPath = 'a'.repeat(1000);
      expect(isValidUrl(`https://shop.com/${longPath}`)).toBe(true);
    });
  });
});
