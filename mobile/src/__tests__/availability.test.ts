import { computeAvailability, describeAvailability } from '../utils/availability';

describe('computeAvailability', () => {
  const NOW = new Date('2026-04-25T15:00:00Z');

  it('returns unknown when availableSizes list is missing', () => {
    const r = computeAvailability('M', undefined, NOW);
    expect(r.status).toBe('unknown');
    expect(r.size).toBe('M');
    expect(r.checkedAt).toBe('2026-04-25T15:00:00.000Z');
  });

  it('returns unknown when availableSizes list is empty', () => {
    const r = computeAvailability('M', [], NOW);
    expect(r.status).toBe('unknown');
  });

  it('returns unknown when recommendedSize is missing', () => {
    const r = computeAvailability(null, ['XS', 'S', 'M'], NOW);
    expect(r.status).toBe('unknown');
    expect(r.size).toBeUndefined();
  });

  it('returns in_stock when recommended size matches', () => {
    const r = computeAvailability('M', ['XS', 'S', 'M', 'L'], NOW);
    expect(r.status).toBe('in_stock');
    expect(r.size).toBe('M');
  });

  it('returns out_of_stock when recommended size is missing from list', () => {
    const r = computeAvailability('XL', ['XS', 'S', 'M'], NOW);
    expect(r.status).toBe('out_of_stock');
    expect(r.size).toBe('XL');
  });

  it('matches case-insensitively', () => {
    expect(computeAvailability('m', ['XS', 'S', 'M'], NOW).status).toBe('in_stock');
    expect(computeAvailability('  M  ', ['XS', 'S', 'M'], NOW).status).toBe('in_stock');
    expect(computeAvailability('M', ['xs', 's', 'm'], NOW).status).toBe('in_stock');
  });

  it('preserves the original-case recommendedSize on the returned state', () => {
    const r = computeAvailability('m', ['XS', 'S', 'M'], NOW);
    // Returned size keeps the input casing — display layer can
    // upper-case if needed, but the source-of-truth is the request.
    expect(r.size).toBe('m');
  });
});

describe('describeAvailability', () => {
  it('formats in_stock with size', () => {
    expect(describeAvailability('in_stock', 'M')).toBe('in stock · M');
  });

  it('formats in_stock without size', () => {
    expect(describeAvailability('in_stock')).toBe('in stock');
  });

  it('formats out_of_stock with size', () => {
    expect(describeAvailability('out_of_stock', 'XL')).toBe('out of stock · XL');
  });

  it('formats out_of_stock without size', () => {
    expect(describeAvailability('out_of_stock')).toBe('out of stock');
  });

  it('formats unknown', () => {
    expect(describeAvailability('unknown')).toBe('stock unknown');
    expect(describeAvailability('unknown', 'M')).toBe('stock unknown');
  });
});
