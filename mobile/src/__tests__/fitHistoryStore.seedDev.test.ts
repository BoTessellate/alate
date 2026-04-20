/**
 * Unit tests — seedDevHistory store action.
 *
 * Contract: seeds the raw entries if and only if history is currently empty.
 * This prevents the __DEV__ seeder from clobbering real data the user has
 * accumulated while testing the app. Called from App.tsx at init.
 */

import { useFitHistoryStore, FitHistoryEntry } from '../store/fitHistoryStore';

const RAW: Omit<FitHistoryEntry, 'id'>[] = [
  {
    url: 'https://test/1',
    productName: 'Test 1',
    fitScore: 'great',
    warnings: [],
    checkedAt: new Date().toISOString(),
  },
  {
    url: 'https://test/2',
    productName: 'Test 2',
    fitScore: 'moderate',
    warnings: [],
    checkedAt: new Date().toISOString(),
  },
];

describe('fitHistoryStore — seedDevHistory', () => {
  beforeEach(() => {
    useFitHistoryStore.setState({ entries: [] });
  });

  it('seeds entries when history is empty', () => {
    useFitHistoryStore.getState().seedDevHistory(RAW);
    const entries = useFitHistoryStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].productName).toBe('Test 1');
    expect(entries[1].productName).toBe('Test 2');
    // Each entry must get a generated id — the raw seed doesn't carry one.
    expect(entries[0].id).toBeTruthy();
    expect(entries[1].id).toBeTruthy();
    expect(entries[0].id).not.toBe(entries[1].id);
  });

  it('is a no-op when history already has entries', () => {
    useFitHistoryStore.getState().addEntry({
      url: 'https://existing/1',
      productName: 'Existing',
      fitScore: 'great',
      warnings: [],
      checkedAt: new Date().toISOString(),
    });
    const before = useFitHistoryStore.getState().entries;
    expect(before).toHaveLength(1);

    useFitHistoryStore.getState().seedDevHistory(RAW);

    const after = useFitHistoryStore.getState().entries;
    expect(after).toHaveLength(1);
    expect(after[0].productName).toBe('Existing');
  });

  it('does not leak state between callers (ids are unique across calls)', () => {
    useFitHistoryStore.getState().seedDevHistory(RAW);
    const firstIds = useFitHistoryStore.getState().entries.map((e) => e.id);

    // Clear then re-seed with same raw input — ids should differ.
    useFitHistoryStore.getState().clearHistory();
    useFitHistoryStore.getState().seedDevHistory(RAW);
    const secondIds = useFitHistoryStore.getState().entries.map((e) => e.id);

    expect(firstIds).not.toEqual(secondIds);
  });
});
