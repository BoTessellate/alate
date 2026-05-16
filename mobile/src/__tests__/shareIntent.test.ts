import { extractSharedUrl } from '../utils/shareIntent';

describe('extractSharedUrl', () => {
  it('returns a bare http(s) URL unchanged', () => {
    expect(extractSharedUrl('https://example.com/products/abc')).toBe(
      'https://example.com/products/abc'
    );
  });

  it('trims surrounding whitespace and newlines', () => {
    expect(extractSharedUrl('  https://example.com/p  \n')).toBe(
      'https://example.com/p'
    );
  });

  it('pulls the URL out of a "page title + link" share blob', () => {
    expect(
      extractSharedUrl('Emporio Armani Jumper https://www.armani.com/p/123')
    ).toBe('https://www.armani.com/p/123');
  });

  it('strips a trailing #fragment', () => {
    expect(
      extractSharedUrl('https://example.com/p#:~:text=hello')
    ).toBe('https://example.com/p');
  });

  it('strips trailing punctuation that clings in prose', () => {
    expect(extractSharedUrl('check this (https://example.com/p).')).toBe(
      'https://example.com/p'
    );
  });

  it('keeps query parameters intact', () => {
    expect(extractSharedUrl('https://example.com/p?variant=42')).toBe(
      'https://example.com/p?variant=42'
    );
  });

  it('preserves a trailing slash (Armani regression)', () => {
    // Shared via the system share-sheet, this exact link produced an
    // "isn't on the platform" error while pasting it worked.
    const armani =
      'https://www.armani.com/en-in/emporio-armani/short-sleeved-jumper-with-perforated-knit-cod-EW004675-AF25815-F1054/';
    expect(extractSharedUrl(armani)).toBe(armani);
  });

  it('returns null for non-URL text', () => {
    expect(extractSharedUrl('just some shared text')).toBeNull();
  });

  it('returns null for a non-http(s) protocol', () => {
    expect(extractSharedUrl('ftp://example.com/file')).toBeNull();
  });

  it('returns null for empty / null / undefined input', () => {
    expect(extractSharedUrl('')).toBeNull();
    expect(extractSharedUrl(null)).toBeNull();
    expect(extractSharedUrl(undefined)).toBeNull();
  });
});
