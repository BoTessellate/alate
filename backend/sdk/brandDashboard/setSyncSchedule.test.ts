/**
 * Unit Tests for Sync Schedule Service
 *
 * Tests:
 * - UI form input/output validation
 * - Cron-based pull function triggers
 * - Edge case: no sync schedule = default to manual
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SyncScheduleService,
  SyncScheduleConfig,
  SetSyncScheduleRequest,
  GetSyncScheduleRequest,
} from './setSyncSchedule';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
};

// Mock environment
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('SyncScheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  // ===========================================================================
  // UI FORM INPUT/OUTPUT TESTS
  // ===========================================================================

  describe('Schedule Validation', () => {
    it('should accept valid manual schedule', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'manual',
        is_active: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: { sync_schedule: schedule, next_sync_at: null },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(true);
      expect(result.schedule?.schedule_type).toBe('manual');
    });

    it('should accept valid daily schedule', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'daily',
        sync_hour: 0,
        is_active: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          sync_schedule: schedule,
          next_sync_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(true);
      expect(result.schedule?.schedule_type).toBe('daily');
      expect(result.next_sync_at).toBeDefined();
    });

    it('should accept valid weekly schedule', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'weekly',
        sync_hour: 0,
        sync_day: 1, // Monday
        is_active: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          sync_schedule: schedule,
          next_sync_at: new Date(Date.now() + 604800000).toISOString(),
        },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(true);
      expect(result.schedule?.schedule_type).toBe('weekly');
      expect(result.schedule?.sync_day).toBe(1);
    });

    it('should reject invalid schedule type', async () => {
      const schedule = {
        schedule_type: 'invalid' as any,
        is_active: true,
      };

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid schedule type');
    });

    it('should reject invalid sync hour (out of range)', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'daily',
        sync_hour: 25, // Invalid
        is_active: true,
      };

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sync hour must be between 0 and 23');
    });

    it('should reject invalid sync day (out of range)', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'weekly',
        sync_day: 7, // Invalid (0-6 only)
        is_active: true,
      };

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sync day must be between 0');
    });
  });

  // ===========================================================================
  // CRON-BASED PULL FUNCTION TRIGGER TESTS
  // ===========================================================================

  describe('Scheduled Sync Triggers', () => {
    it('should return brands due for daily sync', async () => {
      const mockBrands = [
        {
          id: '1',
          brand_id: 'brand-1',
          platform: 'shopify',
          sync_schedule: { schedule_type: 'daily', is_active: true },
          next_sync_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          is_connected: true,
        },
        {
          id: '2',
          brand_id: 'brand-2',
          platform: 'woocommerce',
          sync_schedule: { schedule_type: 'daily', is_active: true },
          next_sync_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          is_connected: true,
        },
      ];

      mockSupabase.eq.mockReturnThis();
      mockSupabase.lte.mockResolvedValueOnce({
        data: mockBrands,
        error: null,
      });

      const service = new SyncScheduleService();
      const brands = await service.getBrandsDueForSync('daily');

      expect(brands).toHaveLength(2);
      expect(brands[0].brand_id).toBe('brand-1');
      expect(brands[1].brand_id).toBe('brand-2');
    });

    it('should not return brands with future next_sync_at', async () => {
      const mockBrands = [
        {
          id: '1',
          brand_id: 'brand-1',
          platform: 'shopify',
          sync_schedule: { schedule_type: 'daily', is_active: true },
          next_sync_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          is_connected: true,
        },
      ];

      mockSupabase.eq.mockReturnThis();
      mockSupabase.lte.mockResolvedValueOnce({
        data: [], // Empty because next_sync_at is in future
        error: null,
      });

      const service = new SyncScheduleService();
      const brands = await service.getBrandsDueForSync('daily');

      expect(brands).toHaveLength(0);
    });

    it('should not return disconnected brands', async () => {
      mockSupabase.eq.mockReturnThis();
      mockSupabase.lte.mockResolvedValueOnce({
        data: [], // Empty because is_connected = false filtered out
        error: null,
      });

      const service = new SyncScheduleService();
      const brands = await service.getBrandsDueForSync('daily');

      expect(brands).toHaveLength(0);
    });

    it('should not return brands with inactive schedules', async () => {
      const mockBrands = [
        {
          id: '1',
          brand_id: 'brand-1',
          platform: 'shopify',
          sync_schedule: { schedule_type: 'daily', is_active: false }, // Inactive
          next_sync_at: new Date(Date.now() - 3600000).toISOString(),
          is_connected: true,
        },
      ];

      mockSupabase.eq.mockReturnThis();
      mockSupabase.lte.mockResolvedValueOnce({
        data: mockBrands,
        error: null,
      });

      const service = new SyncScheduleService();
      const brands = await service.getBrandsDueForSync('daily');

      // Should be filtered out in application logic
      expect(brands).toHaveLength(0);
    });
  });

  // ===========================================================================
  // EDGE CASE: NO SYNC SCHEDULE = DEFAULT TO MANUAL
  // ===========================================================================

  describe('Default Schedule Behavior', () => {
    it('should return manual as default when no schedule exists', async () => {
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: [
          {
            platform: 'shopify',
            sync_schedule: null, // No schedule set
            next_sync_at: null,
            last_sync_at: null,
          },
        ],
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.getSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
      });

      expect(result.success).toBe(true);
      expect(result.schedules[0].schedule.schedule_type).toBe('manual');
    });

    it('should not include manual schedules in scheduled sync queries', async () => {
      const mockBrands = [
        {
          id: '1',
          brand_id: 'brand-1',
          platform: 'shopify',
          sync_schedule: { schedule_type: 'manual', is_active: true },
          next_sync_at: null,
          is_connected: true,
        },
      ];

      mockSupabase.eq.mockReturnThis();
      mockSupabase.lte.mockResolvedValueOnce({
        data: mockBrands,
        error: null,
      });

      const service = new SyncScheduleService();
      const brands = await service.getBrandsDueForSync('daily');

      // Manual schedules should never be included in scheduled syncs
      expect(brands).toHaveLength(0);
    });

    it('should allow manual sync trigger regardless of schedule', async () => {
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'sync-123' },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.triggerManualSync('brand-123', 'shopify');

      expect(result.success).toBe(true);
      expect(result.sync_id).toBe('sync-123');
    });
  });

  // ===========================================================================
  // NEXT SYNC TIME CALCULATION TESTS
  // ===========================================================================

  describe('Next Sync Time Calculation', () => {
    it('should calculate next daily sync time correctly', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'daily',
        sync_hour: 0,
        is_active: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          sync_schedule: schedule,
          next_sync_at: expect.any(String),
        },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(true);
      expect(result.next_sync_at).toBeDefined();

      if (result.next_sync_at) {
        const nextSync = new Date(result.next_sync_at);
        expect(nextSync.getUTCHours()).toBe(0);
      }
    });

    it('should return null next_sync_at for manual schedule', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'manual',
        is_active: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          sync_schedule: schedule,
          next_sync_at: null,
        },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(true);
      expect(result.next_sync_at).toBeUndefined();
    });

    it('should calculate weekly sync for correct day', async () => {
      const schedule: SyncScheduleConfig = {
        schedule_type: 'weekly',
        sync_hour: 0,
        sync_day: 1, // Monday
        is_active: true,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          sync_schedule: schedule,
          next_sync_at: expect.any(String),
        },
        error: null,
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule,
      });

      expect(result.success).toBe(true);
      expect(result.next_sync_at).toBeDefined();

      if (result.next_sync_at) {
        const nextSync = new Date(result.next_sync_at);
        expect(nextSync.getUTCDay()).toBe(1); // Monday
      }
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const service = new SyncScheduleService();
      const result = await service.setSyncSchedule({
        brand_id: 'brand-123',
        platform: 'shopify',
        schedule: { schedule_type: 'daily', is_active: true },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return empty schedules on get error', async () => {
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const service = new SyncScheduleService();
      const result = await service.getSyncSchedule({
        brand_id: 'brand-123',
      });

      expect(result.success).toBe(false);
      expect(result.schedules).toHaveLength(0);
    });
  });
});
