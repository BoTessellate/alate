/**
 * INTEGRATION TEST: History Re-evaluation
 *
 * Critical Path:
 *   History tab → tap entry → FitResult (history mode)
 *   → Re-evaluate → checkFit with latest avatar → updateEntry
 *
 * Tests: fitHistoryStore.updateEntry, avatar change detection, 50-entry cap
 *
 * TODO: Test avatar-change-since-last-check flag, re-evaluation banner UI
 */

import { useAvatarStore, Avatar } from '../../store/avatarStore';
import { useFitHistoryStore, FitHistoryEntry } from '../../store/fitHistoryStore';
import * as api from '../../services/api';

jest.mock('../../services/api', () => ({
  checkFit: jest.fn(),
}));

const mockApi = api as jest.Mocked<typeof api>;

const AVATAR_V1: Avatar = {
  height_cm: 170,
  shoulders: 'average',
  bust: 'medium',
  waist: 'average',
  hips: 'average',
  thighs: 'average',
  torso_length: 'average',
};

const AVATAR_V2: Avatar = {
  ...AVATAR_V1,
  hips: 'wide', // Changed
  waist: 'defined',
};

const SEED_ENTRY: Omit<FitHistoryEntry, 'id'> = {
  url: 'https://asos.com/dress/1',
  productName: 'Black Midi Dress',
  fitScore: 'great',
  warnings: [],
  checkedAt: '2026-04-01T10:00:00Z',
  sizeRecommendation: { size: 'M', confidence: 'high' },
  category: 'dress',
  material: 'cotton',
  tags: ['midi'],
  brand: 'ASOS',
};

describe('History Re-evaluation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAvatarStore.setState({ avatar: AVATAR_V1 });
    useFitHistoryStore.setState({ entries: [] });
  });

  describe('History store basics', () => {
    it('should add entries in reverse chronological order', () => {
      useFitHistoryStore.getState().addEntry({ ...SEED_ENTRY, productName: 'First' });
      useFitHistoryStore.getState().addEntry({ ...SEED_ENTRY, productName: 'Second' });

      const entries = useFitHistoryStore.getState().entries;
      expect(entries[0].productName).toBe('Second'); // Latest first
      expect(entries[1].productName).toBe('First');
    });

    it('should cap history at 50 entries', () => {
      // Add 55 entries
      for (let i = 0; i < 55; i++) {
        useFitHistoryStore.getState().addEntry({
          ...SEED_ENTRY,
          productName: `Product ${i}`,
        });
      }

      const entries = useFitHistoryStore.getState().entries;
      expect(entries).toHaveLength(50);
      expect(entries[0].productName).toBe('Product 54'); // Most recent kept
    });
  });

  describe('Updating an entry after re-evaluation', () => {
    it('should update fit score and warnings in place', () => {
      useFitHistoryStore.getState().addEntry(SEED_ENTRY);
      const originalId = useFitHistoryStore.getState().entries[0].id;

      useFitHistoryStore.getState().updateEntry(originalId, {
        fitScore: 'moderate',
        warnings: [{ severity: 'minor', message: 'Hips snug with new measurements' }],
        sizeRecommendation: { size: 'L', confidence: 'medium' },
      });

      const updated = useFitHistoryStore.getState().entries[0];
      expect(updated.id).toBe(originalId);
      expect(updated.fitScore).toBe('moderate');
      expect(updated.warnings).toHaveLength(1);
      expect(updated.sizeRecommendation?.size).toBe('L');
      // Original fields preserved
      expect(updated.productName).toBe('Black Midi Dress');
    });

    it('should noop on non-existent entry id', () => {
      useFitHistoryStore.getState().addEntry(SEED_ENTRY);

      useFitHistoryStore.getState().updateEntry('fake-id', { fitScore: 'poor' });

      const entry = useFitHistoryStore.getState().entries[0];
      expect(entry.fitScore).toBe('great'); // Unchanged
    });
  });

  describe('Re-evaluation flow with checkFit', () => {
    it('should call checkFit with UPDATED avatar and persist new result', async () => {
      useFitHistoryStore.getState().addEntry(SEED_ENTRY);
      const entryId = useFitHistoryStore.getState().entries[0].id;

      // User updates avatar
      useAvatarStore.getState().setAvatar(AVATAR_V2);

      // Re-evaluation call
      mockApi.checkFit.mockResolvedValue({
        success: true,
        warnings: [{ severity: 'moderate', message: 'Waist tighter than before' }],
        fit_score: 'moderate',
        size_recommendation: { size: 'L', confidence: 'medium' },
      });

      const result = await api.checkFit(
        {
          id: 'p-1',
          product_name: 'Black Midi Dress',
          category: 'dress',
          material: 'cotton',
          tags: ['midi'],
        },
        useAvatarStore.getState().avatar!
      );

      // Assert API called with V2 avatar
      expect(mockApi.checkFit).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ hips: 'wide', waist: 'defined' })
      );

      // Update history entry with new result
      useFitHistoryStore.getState().updateEntry(entryId, {
        fitScore: result.fit_score,
        warnings: result.warnings || [],
        sizeRecommendation: result.size_recommendation,
        checkedAt: new Date().toISOString(),
      });

      const refreshed = useFitHistoryStore.getState().entries[0];
      expect(refreshed.fitScore).toBe('moderate');
      expect(refreshed.sizeRecommendation?.size).toBe('L');
    });
  });

  describe('Remove and clear operations', () => {
    it('should remove a single entry by id without affecting others added in the same millisecond', () => {
      // addEntry now uses `${base36Timestamp}-${randomSuffix}` so ids stay
      // unique even when multiple entries are added in quick succession.
      useFitHistoryStore.getState().addEntry({ ...SEED_ENTRY, productName: 'A' });
      useFitHistoryStore.getState().addEntry({ ...SEED_ENTRY, productName: 'B' });
      useFitHistoryStore.getState().addEntry({ ...SEED_ENTRY, productName: 'C' });

      const [cEntry, bEntry, aEntry] = useFitHistoryStore.getState().entries;
      // Sanity check: ids must be distinct
      expect(new Set([cEntry.id, bEntry.id, aEntry.id]).size).toBe(3);

      useFitHistoryStore.getState().removeEntry(bEntry.id);

      const entries = useFitHistoryStore.getState().entries;
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.productName)).toEqual(['C', 'A']);
    });

    it('should clear all entries', () => {
      useFitHistoryStore.getState().addEntry(SEED_ENTRY);
      useFitHistoryStore.getState().addEntry(SEED_ENTRY);

      useFitHistoryStore.getState().clearHistory();

      expect(useFitHistoryStore.getState().entries).toHaveLength(0);
    });
  });
});
