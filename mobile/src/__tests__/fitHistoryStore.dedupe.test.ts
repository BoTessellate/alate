/**
 * Regression tests for the dedupe behaviour added when the user reported
 * that re-checking the same product was creating a fresh history card
 * instead of updating the existing one.
 */

import { useFitHistoryStore } from '../store/fitHistoryStore';

const baseEntry = {
  productName: 'Costa Top',
  productImage: 'https://summeraway.in/cdn/shop/files/CostaTop_BlackHW-1.jpg',
  fitScore: 'great' as const,
  warnings: [],
  checkedAt: '2026-04-25T10:00:00Z',
  brand: 'Summer Away',
  material: 'Linen',
  category: 'Top',
};

describe('fitHistoryStore — dedupe on addEntry', () => {
  beforeEach(() => {
    useFitHistoryStore.setState({ entries: [] });
  });

  it('adds a new entry when no matching URL exists', () => {
    useFitHistoryStore.getState().addEntry({
      ...baseEntry,
      url: 'https://summeraway.in/products/costa-top',
    });
    expect(useFitHistoryStore.getState().entries).toHaveLength(1);
  });

  it('updates the existing entry when the same canonical URL is re-added', () => {
    const { addEntry } = useFitHistoryStore.getState();
    addEntry({
      ...baseEntry,
      url: 'https://summeraway.in/products/costa-top',
      checkedAt: '2026-04-25T10:00:00Z',
      fitScore: 'great',
    });
    const firstId = useFitHistoryStore.getState().entries[0].id;

    addEntry({
      ...baseEntry,
      url: 'https://summeraway.in/products/costa-top',
      checkedAt: '2026-04-25T15:00:00Z',
      fitScore: 'moderate', // re-check produced a different fit verdict
    });

    const after = useFitHistoryStore.getState().entries;
    expect(after).toHaveLength(1);
    // Same id (so any open references still resolve)
    expect(after[0].id).toBe(firstId);
    // New fit data wins
    expect(after[0].fitScore).toBe('moderate');
    expect(after[0].checkedAt).toBe('2026-04-25T15:00:00Z');
  });

  it('treats different tracking params on the same product as the same entry', () => {
    const { addEntry } = useFitHistoryStore.getState();
    addEntry({
      ...baseEntry,
      url: 'https://summeraway.in/products/costa-top?pr_prod_strat=e5_desc&pr_rec_id=4463',
    });
    addEntry({
      ...baseEntry,
      url: 'https://summeraway.in/products/costa-top?pr_prod_strat=different&pr_rec_id=999',
    });
    expect(useFitHistoryStore.getState().entries).toHaveLength(1);
  });

  it('treats www. prefix as the same origin', () => {
    const { addEntry } = useFitHistoryStore.getState();
    addEntry({ ...baseEntry, url: 'https://summeraway.in/products/costa-top' });
    addEntry({ ...baseEntry, url: 'https://www.summeraway.in/products/costa-top' });
    expect(useFitHistoryStore.getState().entries).toHaveLength(1);
  });

  it('treats trailing slash as the same path', () => {
    const { addEntry } = useFitHistoryStore.getState();
    addEntry({ ...baseEntry, url: 'https://summeraway.in/products/costa-top' });
    addEntry({ ...baseEntry, url: 'https://summeraway.in/products/costa-top/' });
    expect(useFitHistoryStore.getState().entries).toHaveLength(1);
  });

  it('different products on the same domain stay as separate entries', () => {
    const { addEntry } = useFitHistoryStore.getState();
    addEntry({ ...baseEntry, url: 'https://summeraway.in/products/costa-top' });
    addEntry({ ...baseEntry, productName: 'Another item', url: 'https://summeraway.in/products/something-else' });
    expect(useFitHistoryStore.getState().entries).toHaveLength(2);
  });

  it('moves a re-checked entry to the front of the list', () => {
    const { addEntry } = useFitHistoryStore.getState();
    addEntry({ ...baseEntry, url: 'https://a.com/products/one', productName: 'Item A' });
    addEntry({ ...baseEntry, url: 'https://b.com/products/two', productName: 'Item B' });
    addEntry({ ...baseEntry, url: 'https://c.com/products/three', productName: 'Item C' });

    // List order before re-check: C, B, A (most recent first)
    expect(useFitHistoryStore.getState().entries.map((e) => e.productName)).toEqual([
      'Item C',
      'Item B',
      'Item A',
    ]);

    // Re-check A — it should jump to the front.
    addEntry({ ...baseEntry, url: 'https://a.com/products/one', productName: 'Item A' });
    expect(useFitHistoryStore.getState().entries.map((e) => e.productName)).toEqual([
      'Item A',
      'Item C',
      'Item B',
    ]);
  });
});
