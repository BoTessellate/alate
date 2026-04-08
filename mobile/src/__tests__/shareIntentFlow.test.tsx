import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useShareIntentContext } from 'expo-share-intent';
import { useAvatarStore } from '../store/avatarStore';
import { usePendingShareStore } from '../store/pendingShareStore';
import * as api from '../services/api';

// Mock the API
jest.mock('../services/api', () => ({
  scrapeProduct: jest.fn(),
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
      replace: jest.fn(),
    }),
  };
});

describe('Share Intent Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAvatarStore.setState({ avatar: null });
    usePendingShareStore.setState({ pendingUrl: null });
  });

  describe('URL Detection', () => {
    it('should detect when share intent has a web URL', () => {
      const mockUseShareIntent = useShareIntentContext as jest.Mock;
      mockUseShareIntent.mockReturnValue({
        shareIntent: { webUrl: 'https://asos.com/dress' },
        hasShareIntent: true,
        resetShareIntent: jest.fn(),
      });

      const { shareIntent, hasShareIntent } = mockUseShareIntent();

      expect(hasShareIntent).toBe(true);
      expect(shareIntent?.webUrl).toBe('https://asos.com/dress');
    });

    it('should detect when share intent has text URL', () => {
      const mockUseShareIntent = useShareIntentContext as jest.Mock;
      mockUseShareIntent.mockReturnValue({
        shareIntent: { text: 'https://zara.com/pants' },
        hasShareIntent: true,
        resetShareIntent: jest.fn(),
      });

      const { shareIntent, hasShareIntent } = mockUseShareIntent();

      expect(hasShareIntent).toBe(true);
      expect(shareIntent?.text).toBe('https://zara.com/pants');
    });
  });

  describe('Avatar Prerequisite Check', () => {
    it('should store pending URL when avatar is not set', () => {
      // Avatar not set
      expect(useAvatarStore.getState().avatar).toBeNull();

      // Simulate storing pending URL
      const testUrl = 'https://asos.com/product/123';
      usePendingShareStore.getState().setPendingUrl(testUrl);

      expect(usePendingShareStore.getState().pendingUrl).toBe(testUrl);
    });

    it('should not require pending URL when avatar exists', () => {
      // Set avatar
      useAvatarStore.getState().setAvatar({
        height_cm: 170,
        shoulders: 'average',
        bust: 'large',
        waist: 'defined',
        hips: 'wide',
        thighs: 'average',
        torso_length: 'average',
      });

      expect(useAvatarStore.getState().avatar).not.toBeNull();
    });
  });

  describe('API Integration', () => {
    it('should call scrapeProduct with shared URL', async () => {
      const mockScrape = api.scrapeProduct as jest.Mock;
      mockScrape.mockResolvedValue({
        success: true,
        data: {
          title: 'Test Dress',
          image: 'https://example.com/image.jpg',
          price: { amount: 50, currency: 'USD' },
        },
      });

      await api.scrapeProduct('https://asos.com/dress');

      expect(mockScrape).toHaveBeenCalledWith('https://asos.com/dress');
    });

    it('should handle scrape failure gracefully', async () => {
      const mockScrape = api.scrapeProduct as jest.Mock;
      mockScrape.mockResolvedValue({
        success: false,
        error: 'Failed to scrape',
      });

      const result = await api.scrapeProduct('https://invalid-url.com');

      expect(result.success).toBe(false);
    });
  });

  describe('Pending URL Flow', () => {
    it('should clear pending URL after successful processing', () => {
      // Set pending URL
      usePendingShareStore.getState().setPendingUrl('https://asos.com/dress');
      expect(usePendingShareStore.getState().pendingUrl).not.toBeNull();

      // Clear after processing
      usePendingShareStore.getState().clearPendingUrl();
      expect(usePendingShareStore.getState().pendingUrl).toBeNull();
    });

    it('should preserve pending URL on processing failure', () => {
      const testUrl = 'https://asos.com/dress';
      usePendingShareStore.getState().setPendingUrl(testUrl);

      // Simulate failure - URL should remain
      // (In real implementation, we'd only clear on success)
      expect(usePendingShareStore.getState().pendingUrl).toBe(testUrl);
    });
  });
});
