/**
 * Unit Tests for Health Check & Status Monitoring
 *
 * Tests for healthCheck.ts functionality:
 * - Running health checks for all integrations
 * - Platform-specific health checks (Shopify, WooCommerce, Wix)
 * - Status determination (ok, warning, disconnected)
 * - Database updates
 * - Getting health status
 * - Marking integrations as reconnected
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Set environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';

import {
  HealthCheckService,
  runHealthCheck,
  getHealthStatus,
  markReconnected,
  type HealthStatus,
  type HealthCheckResult,
  type HealthCheckSummary,
} from './healthCheck';

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HealthCheckService();
  });

  describe('runHealthCheck', () => {
    it('should check all connected integrations', async () => {
      // Mock integrations query
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            shop_domain: 'test.myshopify.com',
            access_token: 'token-123',
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      // Mock Shopify API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Mock status update
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: null,
      });

      const result = await service.runHealthCheck();

      expect(result.total_checked).toBe(1);
      expect(result.ok_count).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('ok');
    });

    it('should handle empty integrations list', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [],
        error: null,
      });

      const result = await service.runHealthCheck();

      expect(result.total_checked).toBe(0);
      expect(result.ok_count).toBe(0);
      expect(result.warning_count).toBe(0);
      expect(result.disconnected_count).toBe(0);
    });

    it('should handle database query errors', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.runHealthCheck();

      expect(result.total_checked).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should mark integration as warning if no recent activity', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            shop_domain: 'test.myshopify.com',
            access_token: 'token-123',
            is_connected: true,
            last_sync_at: oldDate.toISOString(),
          },
        ],
        error: null,
      });

      // Mock Shopify API response (healthy)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Mock status update
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: null,
      });

      const result = await service.runHealthCheck();

      expect(result.warning_count).toBe(1);
      expect(result.results[0].status).toBe('warning');
    });

    it('should mark integration as disconnected if API fails', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            shop_domain: 'test.myshopify.com',
            access_token: 'token-123',
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      // Mock Shopify API response (unauthorized)
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Mock status update
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: null,
      });

      const result = await service.runHealthCheck();

      expect(result.disconnected_count).toBe(1);
      expect(result.results[0].status).toBe('disconnected');
    });
  });

  describe('Platform-specific health checks', () => {
    beforeEach(() => {
      // Setup for single integration check
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: null,
      });
    });

    it('should check Shopify health correctly', async () => {
      mockSupabase.eq.mockReset();
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            shop_domain: 'test.myshopify.com',
            access_token: 'shpat_123',
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

      const result = await service.runHealthCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.myshopify.com/admin/api/2024-01/shop.json',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Shopify-Access-Token': 'shpat_123',
          }),
        })
      );
      expect(result.results[0].status).toBe('ok');
    });

    it('should check WooCommerce health correctly', async () => {
      mockSupabase.eq.mockReset();
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-2',
            brand_id: 'brand-2',
            platform: 'woocommerce',
            shop_domain: 'shop.example.com',
            access_token: 'woo-token',
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

      const result = await service.runHealthCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://shop.example.com/wp-json/wc/v3/system_status',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer woo-token',
          }),
        })
      );
      expect(result.results[0].status).toBe('ok');
    });

    it('should check Wix health correctly', async () => {
      mockSupabase.eq.mockReset();
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-3',
            brand_id: 'brand-3',
            platform: 'wix',
            shop_domain: 'wix-site.com',
            access_token: 'wix-token',
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

      const result = await service.runHealthCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.wixapis.com/stores/v1/products/query',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'wix-token',
          }),
        })
      );
      expect(result.results[0].status).toBe('ok');
    });

    it('should handle unknown platform', async () => {
      mockSupabase.eq.mockReset();
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-4',
            brand_id: 'brand-4',
            platform: 'unknown_platform',
            shop_domain: 'unknown.com',
            access_token: 'token',
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

      const result = await service.runHealthCheck();

      expect(result.results[0].status).toBe('disconnected');
      expect(result.results[0].status_notes).toContain('Unknown platform');
    });

    it('should handle missing credentials', async () => {
      mockSupabase.eq.mockReset();
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-5',
            brand_id: 'brand-5',
            platform: 'shopify',
            shop_domain: null,
            access_token: null,
            is_connected: true,
            last_sync_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

      const result = await service.runHealthCheck();

      expect(result.results[0].status).toBe('disconnected');
      expect(result.results[0].status_notes).toContain('Missing');
    });
  });

  describe('getHealthStatus', () => {
    it('should get health status for a brand', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            shop_domain: 'test.myshopify.com',
            is_connected: true,
            status: 'ok',
            status_notes: 'Connection healthy',
            last_success: '2024-12-16T00:00:00Z',
            last_failure: null,
            last_sync_at: '2024-12-16T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.getHealthStatus({ brand_id: 'brand-1' });

      expect(result.success).toBe(true);
      expect(result.integrations).toHaveLength(1);
      expect(result.integrations[0].status).toBe('ok');
    });

    it('should filter by platform', async () => {
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            is_connected: true,
            status: 'ok',
          },
        ],
        error: null,
      });

      const result = await service.getHealthStatus({
        brand_id: 'brand-1',
        platform: 'shopify',
      });

      expect(result.success).toBe(true);
      expect(result.integrations).toHaveLength(1);
    });

    it('should default status to disconnected if null', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: [
          {
            id: 'int-1',
            brand_id: 'brand-1',
            platform: 'shopify',
            is_connected: false,
            status: null,
          },
        ],
        error: null,
      });

      const result = await service.getHealthStatus({ brand_id: 'brand-1' });

      expect(result.integrations[0].status).toBe('disconnected');
    });

    it('should handle errors', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getHealthStatus({ brand_id: 'brand-1' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('markReconnected', () => {
    it('should mark integration as reconnected', async () => {
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: null,
      });

      const result = await service.markReconnected('brand-1', 'shopify');

      expect(result).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_connected: true,
          status: 'ok',
          status_notes: 'Reconnected by user',
        })
      );
    });

    it('should return false on error', async () => {
      mockSupabase.eq.mockReturnValueOnce(mockSupabase);
      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      const result = await service.markReconnected('brand-1', 'shopify');

      expect(result).toBe(false);
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runHealthCheck convenience function should work', async () => {
    mockSupabase.eq.mockReturnValueOnce({
      data: [],
      error: null,
    });

    const result = await runHealthCheck();

    expect(result.total_checked).toBe(0);
  });

  it('getHealthStatus convenience function should work', async () => {
    mockSupabase.eq.mockReturnValueOnce({
      data: [],
      error: null,
    });

    const result = await getHealthStatus({ brand_id: 'brand-1' });

    expect(result.success).toBe(true);
  });

  it('markReconnected convenience function should work', async () => {
    mockSupabase.eq.mockReturnValueOnce(mockSupabase);
    mockSupabase.eq.mockReturnValueOnce({
      data: null,
      error: null,
    });

    const result = await markReconnected('brand-1', 'shopify');

    expect(result).toBe(true);
  });
});

describe('Recent Activity Detection', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HealthCheckService();
  });

  it('should detect activity within threshold', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3); // 3 days ago

    mockSupabase.eq.mockReturnValueOnce({
      data: [
        {
          id: 'int-1',
          brand_id: 'brand-1',
          platform: 'shopify',
          shop_domain: 'test.myshopify.com',
          access_token: 'token',
          is_connected: true,
          last_sync_at: recentDate.toISOString(),
        },
      ],
      error: null,
    });

    (global.fetch as any).mockResolvedValueOnce({ ok: true });
    mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

    const result = await service.runHealthCheck();

    expect(result.results[0].status).toBe('ok');
  });

  it('should flag stale activity', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 14); // 14 days ago

    mockSupabase.eq.mockReturnValueOnce({
      data: [
        {
          id: 'int-1',
          brand_id: 'brand-1',
          platform: 'shopify',
          shop_domain: 'test.myshopify.com',
          access_token: 'token',
          is_connected: true,
          last_sync_at: oldDate.toISOString(),
        },
      ],
      error: null,
    });

    (global.fetch as any).mockResolvedValueOnce({ ok: true });
    mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

    const result = await service.runHealthCheck();

    expect(result.results[0].status).toBe('warning');
    expect(result.results[0].status_notes).toContain('7 days');
  });

  it('should handle null last_sync_at', async () => {
    mockSupabase.eq.mockReturnValueOnce({
      data: [
        {
          id: 'int-1',
          brand_id: 'brand-1',
          platform: 'shopify',
          shop_domain: 'test.myshopify.com',
          access_token: 'token',
          is_connected: true,
          last_sync_at: null,
        },
      ],
      error: null,
    });

    (global.fetch as any).mockResolvedValueOnce({ ok: true });
    mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

    const result = await service.runHealthCheck();

    expect(result.results[0].status).toBe('warning');
  });
});

describe('Error Handling', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HealthCheckService();
  });

  it('should handle network errors during health check', async () => {
    mockSupabase.eq.mockReturnValueOnce({
      data: [
        {
          id: 'int-1',
          brand_id: 'brand-1',
          platform: 'shopify',
          shop_domain: 'test.myshopify.com',
          access_token: 'token',
          is_connected: true,
          last_sync_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

    const result = await service.runHealthCheck();

    expect(result.results[0].status).toBe('disconnected');
    expect(result.results[0].status_notes).toContain('Network error');
  });

  it('should handle API error responses', async () => {
    mockSupabase.eq.mockReturnValueOnce({
      data: [
        {
          id: 'int-1',
          brand_id: 'brand-1',
          platform: 'shopify',
          shop_domain: 'test.myshopify.com',
          access_token: 'token',
          is_connected: true,
          last_sync_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    mockSupabase.eq.mockReturnValueOnce({ data: null, error: null });

    const result = await service.runHealthCheck();

    expect(result.results[0].status).toBe('disconnected');
    expect(result.results[0].status_notes).toContain('500');
  });
});
