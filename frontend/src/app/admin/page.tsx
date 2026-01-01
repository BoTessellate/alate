'use client';

import { useState, useEffect } from 'react';
import {
  Store,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Package,
  Clock,
  Zap,
  Database,
  Brain,
  Search,
  Image,
  Palette,
  Server,
  Wifi,
  WifiOff,
  Activity,
  FileText,
  Globe,
  Key,
  AlertTriangle,
  Info,
  Sparkles,
  Cpu,
  TestTube,
  GitBranch,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui';

// Test coverage data interface
interface TestCoverageData {
  frontend: {
    jest: {
      suites: number;
      tests: number;
      passed: number;
      failed: number;
      lastRun: string;
    };
    cypress: {
      suites: number;
      tests: number;
      passed: number;
      failed: number;
      lastRun: string;
    };
  };
  backend: {
    vitest: {
      suites: number;
      tests: number;
      passed: number;
      failed: number;
      coverage: number;
      lastRun: string;
    };
  };
  lastUpdated: string;
  gitBranch: string;
  gitCommit: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-ramsaptamis-projects.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Integration configurations
const INTEGRATIONS = [
  {
    id: 'supabase',
    name: 'Supabase',
    icon: Database,
    description: 'Database & Auth',
    testEndpoint: null, // Client-side test
    envVars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  },
  {
    id: 'search',
    name: 'Search API',
    icon: Search,
    description: 'Semantic product search',
    testEndpoint: '/api/search',
    method: 'POST',
    testBody: { prompt: 'test', limit: 1 },
    envVars: ['PINECONE_API_KEY', 'PINECONE_INDEX_NAME'],
  },
  {
    id: 'enrich',
    name: 'Product Enrichment',
    icon: Brain,
    description: 'AI product metadata',
    testEndpoint: '/api/ai?action=enrich',
    method: 'POST',
    testBody: { url: 'https://example.com/test', dry_run: true },
    envVars: ['ANTHROPIC_API_KEY'],
  },
  {
    id: 'layout',
    name: 'Layout Generator',
    icon: Palette,
    description: 'Moodboard layouts',
    testEndpoint: '/api/ai?action=layout',
    method: 'POST',
    testBody: { productIds: [], boardSize: { width: 800, height: 600 }, dry_run: true },
    envVars: [],
  },
  {
    id: 'smart-labels',
    name: 'Smart Labels',
    icon: FileText,
    description: 'AI label placement',
    testEndpoint: '/api/ai?action=labels',
    method: 'POST',
    testBody: { items: [], dry_run: true },
    envVars: ['ANTHROPIC_API_KEY'],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    icon: Store,
    description: 'E-commerce sync',
    testEndpoint: '/api/shopify',
    method: 'GET',
    queryParams: { action: 'status', shop: 'test.myshopify.com' },
    envVars: ['SHOPIFY_API_KEY', 'SHOPIFY_SECRET', 'SHOPIFY_TOKEN_ENCRYPTION_KEY'],
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: FileText,
    description: 'Task management',
    testEndpoint: '/api/notion-fetch',
    method: 'GET',
    envVars: ['NOTION_API_KEY'],
  },
];


interface IntegrationStatus {
  id: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  latency?: number;
  message?: string;
  details?: unknown;
  testedAt?: string;
}

// Storage key for persisting test results
const STORAGE_KEY = 'tml_admin_integration_status';

// Load cached status from localStorage
const loadCachedStatus = (): IntegrationStatus[] => {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Only return if less than 24 hours old
      if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data.statuses || [];
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

// Save status to localStorage
const saveCachedStatus = (statuses: IntegrationStatus[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      timestamp: Date.now(),
      statuses,
    }));
  } catch {
    // Ignore storage errors
  }
};

interface ShopifyStatus {
  connected: boolean;
  shop_domain?: string;
  products_count?: number;
  last_sync?: string;
  recent_syncs?: Array<{
    sync_id: string;
    status: string;
    products_synced: number;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
  }>;
  error?: string;
}

interface SyncResult {
  success: boolean;
  sync_id?: string;
  products_synced?: number;
  products_enriched?: number;
  products_failed?: number;
  duration_ms?: number;
  errors?: string[];
  error?: string;
  message?: string;
}

// AI Provider Status types
interface AIProviderInfo {
  available: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
  model?: string;
  lastChecked?: string;
}

interface AIProviderStatus {
  anthropic: AIProviderInfo;
  gemini: AIProviderInfo;
  openai: AIProviderInfo;
  timestamp: string;
  cached: boolean;
  summary: {
    total: number;
    configured: number;
    available: number;
    health: 'healthy' | 'degraded' | 'critical';
  };
  fallbackStatus: {
    enrichment: string;
    imageGen: string;
    virtualTryOn: string;
  };
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'shopify'>('health');
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatus[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);

  // Shopify state
  const [shopDomain, setShopDomain] = useState('store-1-2352745.myshopify.com');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local dev state
  const [frontendRunning, setFrontendRunning] = useState<boolean | null>(null);
  const [backendRunning, setBackendRunning] = useState<boolean | null>(null);

  // AI Provider state
  const [aiStatus, setAiStatus] = useState<AIProviderStatus | null>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);

  // Test coverage state
  const [testCoverage, setTestCoverage] = useState<TestCoverageData | null>(null);

  // Load cached test results on mount
  useEffect(() => {
    const cached = loadCachedStatus();
    if (cached.length > 0) {
      setIntegrationStatuses(cached);
    }
  }, []);

  // Load test coverage from JSON file
  useEffect(() => {
    fetch('/test-coverage.json')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setTestCoverage(data);
      })
      .catch(() => {
        // Coverage file not available yet
      });
  }, []);

  // Check if local servers are running
  useEffect(() => {
    // Frontend is running if we can load this page
    setFrontendRunning(true);

    // Check backend
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      // Any HTTP response means backend is reachable (even 401/403)
      // Only network errors should show as "not running"
      await fetch(`${API_URL}/api/search`, { method: 'OPTIONS' });
      setBackendRunning(true);
    } catch {
      setBackendRunning(false);
    }
  };

  // Check AI provider status
  const checkAIProviderStatus = async (forceRefresh = false) => {
    setIsCheckingAI(true);
    try {
      const url = `${API_URL}/api/ai-status${forceRefresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAiStatus(data);
      } else {
        console.error('AI status check failed:', response.status);
      }
    } catch (err) {
      console.error('AI status check error:', err);
    } finally {
      setIsCheckingAI(false);
    }
  };

  // Load AI status on mount
  useEffect(() => {
    checkAIProviderStatus();
  }, []);

  // Test all integrations
  const testAllIntegrations = async () => {
    setIsTestingAll(true);
    setError(null);

    const statuses: IntegrationStatus[] = INTEGRATIONS.map((i) => ({
      id: i.id,
      status: 'pending',
    }));
    setIntegrationStatuses(statuses);

    for (let i = 0; i < INTEGRATIONS.length; i++) {
      const integration = INTEGRATIONS[i];
      const start = Date.now();

      try {
        if (integration.id === 'supabase') {
          // Test Supabase client-side
          if (SUPABASE_URL) {
            statuses[i] = {
              id: integration.id,
              status: 'success',
              latency: Date.now() - start,
              message: 'Configured',
            };
          } else {
            statuses[i] = {
              id: integration.id,
              status: 'warning',
              message: 'URL not configured',
            };
          }
        } else if (integration.testEndpoint) {
          let url = `${API_URL}${integration.testEndpoint}`;
          if (integration.queryParams) {
            const params = new URLSearchParams(integration.queryParams as Record<string, string>);
            url += `?${params}`;
          }

          const response = await fetch(url, {
            method: integration.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: integration.method === 'POST' ? JSON.stringify(integration.testBody) : undefined,
          });

          const latency = Date.now() - start;

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            statuses[i] = {
              id: integration.id,
              status: 'success',
              latency,
              message: 'Online',
              details: data,
            };
          } else if (response.status === 404) {
            statuses[i] = {
              id: integration.id,
              status: 'error',
              latency,
              message: '404 - Endpoint not found',
            };
          } else {
            const errorData = await response.json().catch(() => ({}));
            statuses[i] = {
              id: integration.id,
              status: response.status === 401 || response.status === 400 ? 'warning' : 'error',
              latency,
              message: errorData.message || errorData.error || `HTTP ${response.status}`,
            };
          }
        }
      } catch (err) {
        statuses[i] = {
          id: integration.id,
          status: 'error',
          latency: Date.now() - start,
          message: err instanceof Error ? err.message : 'Connection failed',
        };
      }

      // Add timestamp to each status
      statuses[i].testedAt = new Date().toISOString();
      setIntegrationStatuses([...statuses]);
    }

    // Save to localStorage for persistence
    saveCachedStatus(statuses);
    setIsTestingAll(false);
  };

  // Test a single integration
  const testSingleIntegration = async (integrationId: string) => {
    const integration = INTEGRATIONS.find(i => i.id === integrationId);
    if (!integration) return;

    const existingStatuses = [...integrationStatuses];
    const index = existingStatuses.findIndex(s => s.id === integrationId);

    // Set to pending
    if (index >= 0) {
      existingStatuses[index] = { id: integrationId, status: 'pending' };
    } else {
      existingStatuses.push({ id: integrationId, status: 'pending' });
    }
    setIntegrationStatuses(existingStatuses);

    const start = Date.now();
    let newStatus: IntegrationStatus;

    try {
      if (integration.id === 'supabase') {
        if (SUPABASE_URL) {
          newStatus = { id: integrationId, status: 'success', latency: Date.now() - start, message: 'Configured', testedAt: new Date().toISOString() };
        } else {
          newStatus = { id: integrationId, status: 'warning', message: 'URL not configured', testedAt: new Date().toISOString() };
        }
      } else if (integration.testEndpoint) {
        let url = `${API_URL}${integration.testEndpoint}`;
        if (integration.queryParams) {
          const params = new URLSearchParams(integration.queryParams as Record<string, string>);
          url += `?${params}`;
        }

        const response = await fetch(url, {
          method: integration.method || 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: integration.method === 'POST' ? JSON.stringify(integration.testBody) : undefined,
        });

        const latency = Date.now() - start;

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          newStatus = { id: integrationId, status: 'success', latency, message: 'Online', details: data, testedAt: new Date().toISOString() };
        } else if (response.status === 404) {
          newStatus = { id: integrationId, status: 'error', latency, message: '404 - Endpoint not found', testedAt: new Date().toISOString() };
        } else {
          const errorData = await response.json().catch(() => ({}));
          newStatus = {
            id: integrationId,
            status: response.status === 401 || response.status === 400 ? 'warning' : 'error',
            latency,
            message: errorData.message || errorData.error || `HTTP ${response.status}`,
            testedAt: new Date().toISOString(),
          };
        }
      } else {
        newStatus = { id: integrationId, status: 'warning', message: 'No test endpoint', testedAt: new Date().toISOString() };
      }
    } catch (err) {
      newStatus = {
        id: integrationId,
        status: 'error',
        latency: Date.now() - start,
        message: err instanceof Error ? err.message : 'Connection failed',
        testedAt: new Date().toISOString(),
      };
    }

    // Update statuses
    const updatedStatuses = existingStatuses.map(s => s.id === integrationId ? newStatus : s);
    if (!existingStatuses.find(s => s.id === integrationId)) {
      updatedStatuses.push(newStatus);
    }
    setIntegrationStatuses(updatedStatuses);
    saveCachedStatus(updatedStatuses);
  };

  // Shopify functions
  const connectToShopify = () => {
    if (!shopDomain) {
      setError('Please enter a shop domain');
      return;
    }
    setIsConnecting(true);
    setError(null);
    const authUrl = `${API_URL}/api/shopify?action=auth&shop=${encodeURIComponent(shopDomain)}`;
    window.open(authUrl, '_blank');
    setTimeout(() => setIsConnecting(false), 2000);
  };

  const checkStatus = async () => {
    if (!shopDomain) {
      setError('Please enter a shop domain');
      return;
    }
    setIsCheckingStatus(true);
    setError(null);
    setShopifyStatus(null);

    try {
      const response = await fetch(
        `${API_URL}/api/shopify?action=status&shop=${encodeURIComponent(shopDomain)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setShopifyStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setShopifyStatus({ connected: false, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const syncProducts = async () => {
    if (!shopDomain) {
      setError('Please enter a shop domain');
      return;
    }
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch(`${API_URL}/api/shopify?action=sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopDomain }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      setSyncResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setSyncResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 size={18} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />;
      case 'success':
        return <CheckCircle size={18} style={{ color: 'var(--success)' }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: 'var(--warning, #f59e0b)' }} />;
      case 'error':
        return <XCircle size={18} style={{ color: 'var(--error)' }} />;
    }
  };

  const getOverallHealth = () => {
    if (integrationStatuses.length === 0) return null;
    const errors = integrationStatuses.filter((s) => s.status === 'error').length;
    const warnings = integrationStatuses.filter((s) => s.status === 'warning').length;
    const success = integrationStatuses.filter((s) => s.status === 'success').length;

    if (errors > 0) return { status: 'error', label: `${errors} failing`, color: 'var(--error)' };
    if (warnings > 0) return { status: 'warning', label: `${warnings} warnings`, color: 'var(--warning, #f59e0b)' };
    if (success === INTEGRATIONS.length) return { status: 'success', label: 'All healthy', color: 'var(--success)' };
    return null;
  };

  const overallHealth = getOverallHealth();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Admin Dashboard
          </h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            Monitor integrations, debug issues, and manage your development environment
          </p>
        </div>

        {/* Server Status Pills */}
        <div className="flex gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
            style={{
              backgroundColor: frontendRunning ? 'rgba(76, 112, 49, 0.2)' : 'rgba(168, 64, 50, 0.2)',
            }}
          >
            {frontendRunning ? (
              <Wifi size={14} style={{ color: 'var(--success)' }} />
            ) : (
              <WifiOff size={14} style={{ color: 'var(--error)' }} />
            )}
            <span style={{ color: frontendRunning ? 'var(--success)' : 'var(--error)' }}>
              Frontend
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
            style={{
              backgroundColor: backendRunning ? 'rgba(76, 112, 49, 0.2)' : 'rgba(168, 64, 50, 0.2)',
            }}
          >
            {backendRunning ? (
              <Wifi size={14} style={{ color: 'var(--success)' }} />
            ) : (
              <WifiOff size={14} style={{ color: 'var(--error)' }} />
            )}
            <span style={{ color: backendRunning ? 'var(--success)' : 'var(--error)' }}>
              Backend
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="mb-6 p-4 rounded-lg flex items-center gap-3"
          style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)' }}
        >
          <AlertCircle size={20} style={{ color: 'var(--error)' }} />
          <span style={{ color: 'var(--error)' }}>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-lg"
        style={{ backgroundColor: 'var(--surface-light)' }}
      >
        {[
          { id: 'health', label: 'Health', icon: Activity },
          { id: 'shopify', label: 'Shopify', icon: Store },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'secondary' : 'ghost'}
              icon={tab.icon}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="flex-1"
              style={{
                backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
                borderColor: 'transparent',
              }}
            >
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Test Coverage Section */}
          <section
            className="rounded-lg border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}>
                  <TestTube size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    Test Coverage
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                    Updated on each git merge
                  </p>
                </div>
              </div>
              {testCoverage && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <GitBranch size={14} />
                  <span>{testCoverage.gitBranch}</span>
                  <span>({testCoverage.gitCommit})</span>
                </div>
              )}
            </div>

            {testCoverage ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Frontend Jest */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>Frontend (Jest)</span>
                    {testCoverage.frontend.jest.failed === 0 ? (
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <XCircle size={16} style={{ color: 'var(--error)' }} />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Suites</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.frontend.jest.suites}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Tests</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.frontend.jest.tests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Passed</span>
                      <span style={{ color: 'var(--success)' }}>{testCoverage.frontend.jest.passed}</span>
                    </div>
                  </div>
                </div>

                {/* Frontend Cypress */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>E2E (Cypress)</span>
                    {testCoverage.frontend.cypress.failed === 0 ? (
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <XCircle size={16} style={{ color: 'var(--error)' }} />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Suites</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.frontend.cypress.suites}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Tests</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.frontend.cypress.tests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Passed</span>
                      <span style={{ color: 'var(--success)' }}>{testCoverage.frontend.cypress.passed}</span>
                    </div>
                  </div>
                </div>

                {/* Backend Vitest */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>Backend (Vitest)</span>
                    {testCoverage.backend.vitest.failed === 0 ? (
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <XCircle size={16} style={{ color: 'var(--error)' }} />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Suites</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.backend.vitest.suites}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Tests</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.backend.vitest.tests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--foreground-muted)' }}>Coverage</span>
                      <span style={{ color: 'var(--foreground)' }}>{testCoverage.backend.vitest.coverage}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p style={{ color: 'var(--foreground-muted)' }}>
                  No coverage data. Run <code className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--background)' }}>npm run test:report</code> to generate.
                </p>
              </div>
            )}
          </section>

          {/* Overall Health Banner */}
          {overallHealth && (
            <div
              className="p-4 rounded-lg flex items-center justify-between"
              style={{
                backgroundColor:
                  overallHealth.status === 'success'
                    ? 'rgba(76, 112, 49, 0.1)'
                    : overallHealth.status === 'warning'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(168, 64, 50, 0.1)',
              }}
            >
              <div className="flex items-center gap-3">
                {overallHealth.status === 'success' ? (
                  <CheckCircle size={24} style={{ color: overallHealth.color }} />
                ) : overallHealth.status === 'warning' ? (
                  <AlertTriangle size={24} style={{ color: overallHealth.color }} />
                ) : (
                  <XCircle size={24} style={{ color: overallHealth.color }} />
                )}
                <span className="font-medium" style={{ color: overallHealth.color }}>
                  {overallHealth.label}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={testAllIntegrations}
                disabled={isTestingAll}
                loading={isTestingAll}
              >
                Re-test
              </Button>
            </div>
          )}

          {/* Integrations Grid */}
          <section
            className="rounded-lg border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}>
                  <Server size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    Integration Health
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                    Status of all backend services
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                icon={Zap}
                onClick={testAllIntegrations}
                disabled={isTestingAll}
                loading={isTestingAll}
              >
                Test All
              </Button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {INTEGRATIONS.map((integration) => {
                const status = integrationStatuses.find((s) => s.id === integration.id);
                const Icon = integration.icon;
                const isTesting = status?.status === 'pending';

                // Format last tested time
                const getLastTestedLabel = () => {
                  if (!status?.testedAt) return null;
                  const testedAt = new Date(status.testedAt);
                  const now = new Date();
                  const diffMs = now.getTime() - testedAt.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);

                  if (diffMins < 1) return 'Just now';
                  if (diffMins < 60) return `${diffMins}m ago`;
                  if (diffHours < 24) return `${diffHours}h ago`;
                  return `${diffDays}d ago`;
                };

                return (
                  <div
                    key={integration.id}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--surface-light)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: 'var(--background)' }}
                        >
                          <Icon size={18} style={{ color: 'var(--foreground-secondary)' }} />
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                            {integration.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            {integration.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {status ? (
                          <>
                            {getStatusIcon(status.status)}
                            {status.message && status.status !== 'success' && (
                              <span
                                className="text-xs max-w-[80px] truncate"
                                style={{
                                  color: status.status === 'error' ? 'var(--error)' : 'var(--foreground-muted)',
                                }}
                                title={status.message}
                              >
                                {status.message}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            Not tested
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {status?.latency !== undefined && <span>{status.latency}ms</span>}
                        {status?.testedAt && <span>• {getLastTestedLabel()}</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={RefreshCw}
                        onClick={() => testSingleIntegration(integration.id)}
                        disabled={isTesting}
                        loading={isTesting}
                        title="Re-test this integration"
                        style={{ backgroundColor: 'var(--background)' }}
                        className="h-7 px-2 text-xs"
                      >
                        Test
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* AI Provider Status */}
          <section
            className="rounded-lg border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(196, 163, 90, 0.2)' }}>
                  <Cpu size={20} style={{ color: 'var(--highlight)' }} />
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    AI Providers
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                    Status of AI services with fallback chains
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => checkAIProviderStatus(true)}
                disabled={isCheckingAI}
                loading={isCheckingAI}
              >
                Check AI Status
              </Button>
            </div>

            {aiStatus ? (
              <div className="p-4 space-y-4">
                {/* Health Summary */}
                <div
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{
                    backgroundColor: aiStatus.summary.health === 'healthy'
                      ? 'rgba(76, 112, 49, 0.1)'
                      : aiStatus.summary.health === 'degraded'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(168, 64, 50, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    {aiStatus.summary.health === 'healthy' ? (
                      <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                    ) : aiStatus.summary.health === 'degraded' ? (
                      <AlertTriangle size={18} style={{ color: 'var(--warning, #f59e0b)' }} />
                    ) : (
                      <XCircle size={18} style={{ color: 'var(--error)' }} />
                    )}
                    <span className="font-medium" style={{
                      color: aiStatus.summary.health === 'healthy' ? 'var(--success)'
                        : aiStatus.summary.health === 'degraded' ? 'var(--warning, #f59e0b)'
                        : 'var(--error)'
                    }}>
                      {aiStatus.summary.available}/{aiStatus.summary.configured} providers available
                    </span>
                  </div>
                  {aiStatus.cached && (
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-muted)' }}>
                      Cached
                    </span>
                  )}
                </div>

                {/* Provider Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'anthropic', name: 'Claude', icon: Brain, data: aiStatus.anthropic, role: 'Enrichment (Primary)' },
                    { id: 'gemini', name: 'Gemini', icon: Sparkles, data: aiStatus.gemini, role: 'Try-On (Primary), Fallback' },
                    { id: 'openai', name: 'OpenAI', icon: Image, data: aiStatus.openai, role: 'Image Gen (Primary)' },
                  ].map((provider) => {
                    const Icon = provider.icon;
                    return (
                      <div
                        key={provider.id}
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--surface-light)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon size={16} style={{ color: 'var(--foreground-secondary)' }} />
                            <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                              {provider.name}
                            </span>
                          </div>
                          {provider.data.available ? (
                            <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                          ) : provider.data.configured ? (
                            <XCircle size={16} style={{ color: 'var(--error)' }} />
                          ) : (
                            <AlertTriangle size={16} style={{ color: 'var(--foreground-muted)' }} />
                          )}
                        </div>
                        <p className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>
                          {provider.role}
                        </p>
                        <div className="text-xs space-y-1">
                          {provider.data.configured ? (
                            <>
                              <div style={{ color: provider.data.available ? 'var(--success)' : 'var(--error)' }}>
                                {provider.data.available ? 'Online' : provider.data.error || 'Offline'}
                              </div>
                              {provider.data.latencyMs && (
                                <div style={{ color: 'var(--foreground-muted)' }}>
                                  {provider.data.latencyMs}ms latency
                                </div>
                              )}
                              {provider.data.model && (
                                <div style={{ color: 'var(--foreground-muted)' }}>
                                  Model: {provider.data.model}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ color: 'var(--foreground-muted)' }}>
                              Not configured
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fallback Status */}
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--background)' }}
                >
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                    Active Fallback Chains
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span style={{ color: 'var(--foreground-muted)' }}>Enrichment:</span>
                      <div style={{ color: 'var(--foreground)' }}>{aiStatus.fallbackStatus.enrichment}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--foreground-muted)' }}>Image Gen:</span>
                      <div style={{ color: 'var(--foreground)' }}>{aiStatus.fallbackStatus.imageGen}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--foreground-muted)' }}>Virtual Try-On:</span>
                      <div style={{ color: 'var(--foreground)' }}>{aiStatus.fallbackStatus.virtualTryOn}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                {isCheckingAI ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--foreground-muted)' }} />
                    <span style={{ color: 'var(--foreground-muted)' }}>Checking AI providers...</span>
                  </div>
                ) : (
                  <p style={{ color: 'var(--foreground-muted)' }}>
                    Click "Check Status" to test AI provider connectivity
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Environment Info */}
          <section
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Globe size={18} />
              Environment
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>API URL:</span>
                <code
                  className="ml-2 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                >
                  {API_URL}
                </code>
              </div>
              <div>
                <span style={{ color: 'var(--foreground-muted)' }}>Supabase:</span>
                <code
                  className="ml-2 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                >
                  {SUPABASE_URL ? 'Configured' : 'Not configured'}
                </code>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Shopify Tab */}
      {activeTab === 'shopify' && (
        <div className="space-y-6">
          <section
            className="rounded-lg border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="p-4 border-b flex items-center gap-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}>
                <Store size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  Shopify Integration
                </h2>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                  Connect and sync products from Shopify stores
                </p>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Shop Domain
                </label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  className="w-full p-3 rounded-lg border outline-none focus:border-[var(--primary)]"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  icon={ExternalLink}
                  onClick={connectToShopify}
                  disabled={isConnecting}
                  loading={isConnecting}
                >
                  Connect Store
                </Button>
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={checkStatus}
                  disabled={isCheckingStatus}
                  loading={isCheckingStatus}
                >
                  Check Status
                </Button>
                <Button
                  variant="secondary"
                  icon={Package}
                  onClick={syncProducts}
                  disabled={isSyncing}
                  loading={isSyncing}
                >
                  Sync Products
                </Button>
              </div>

              {/* Status Display */}
              {shopifyStatus && (
                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: shopifyStatus.connected ? 'rgba(76, 112, 49, 0.1)' : 'rgba(168, 64, 50, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {shopifyStatus.connected ? (
                      <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                      <XCircle size={20} style={{ color: 'var(--error)' }} />
                    )}
                    <span
                      className="font-medium"
                      style={{ color: shopifyStatus.connected ? 'var(--success)' : 'var(--error)' }}
                    >
                      {shopifyStatus.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  {shopifyStatus.connected && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span style={{ color: 'var(--foreground-muted)' }}>Shop:</span>
                        <span className="ml-2" style={{ color: 'var(--foreground)' }}>
                          {shopifyStatus.shop_domain}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--foreground-muted)' }}>Products:</span>
                        <span className="ml-2" style={{ color: 'var(--foreground)' }}>
                          {shopifyStatus.products_count ?? 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}

                  {shopifyStatus.error && (
                    <p className="text-sm mt-2" style={{ color: 'var(--error)' }}>
                      {shopifyStatus.error}
                    </p>
                  )}

                  {/* Recent Syncs */}
                  {shopifyStatus.recent_syncs && shopifyStatus.recent_syncs.length > 0 && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                        Recent Syncs
                      </h4>
                      <div className="space-y-2">
                        {shopifyStatus.recent_syncs.slice(0, 3).map((sync) => (
                          <div
                            key={sync.sync_id}
                            className="flex items-center justify-between text-xs p-2 rounded"
                            style={{ backgroundColor: 'var(--background)' }}
                          >
                            <span style={{ color: 'var(--foreground-muted)' }}>
                              {new Date(sync.started_at).toLocaleString()}
                            </span>
                            <span
                              style={{
                                color: sync.status === 'completed' ? 'var(--success)' : 'var(--foreground-muted)',
                              }}
                            >
                              {sync.products_synced} products
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sync Result */}
              {syncResult && (
                <div
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: syncResult.success ? 'rgba(76, 112, 49, 0.1)' : 'rgba(168, 64, 50, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {syncResult.success ? (
                      <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                      <XCircle size={20} style={{ color: 'var(--error)' }} />
                    )}
                    <span
                      className="font-medium"
                      style={{ color: syncResult.success ? 'var(--success)' : 'var(--error)' }}
                    >
                      {syncResult.success ? 'Sync Complete' : 'Sync Failed'}
                    </span>
                  </div>

                  {syncResult.success && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Package size={16} style={{ color: 'var(--foreground-muted)' }} />
                        <span>Synced: {syncResult.products_synced}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap size={16} style={{ color: 'var(--foreground-muted)' }} />
                        <span>Enriched: {syncResult.products_enriched}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} style={{ color: 'var(--foreground-muted)' }} />
                        <span>{((syncResult.duration_ms || 0) / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  )}

                  {(syncResult.error || syncResult.message) && (
                    <p className="text-sm mt-2" style={{ color: 'var(--error)' }}>
                      {syncResult.error || syncResult.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Shopify Setup Guide */}
          <section
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Info size={18} />
              Setup Checklist
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { key: 'SHOPIFY_API_KEY', label: 'API Key from Partner Dashboard' },
                { key: 'SHOPIFY_SECRET', label: 'API Secret from Partner Dashboard' },
                { key: 'SHOPIFY_TOKEN_ENCRYPTION_KEY', label: 'Token encryption (openssl rand -hex 32)' },
                { key: 'APP_URL', label: 'Your Vercel deployment URL' },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <Key size={14} style={{ color: 'var(--foreground-muted)' }} />
                  <code
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ backgroundColor: 'var(--background)' }}
                  >
                    {item.key}
                  </code>
                  <span style={{ color: 'var(--foreground-muted)' }}>- {item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
