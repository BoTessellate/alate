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
  Bug,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Server,
  Wifi,
  WifiOff,
  Activity,
  Settings,
  FileText,
  HardDrive,
  Globe,
  Key,
  AlertTriangle,
  Info,
  Play,
  Square,
} from 'lucide-react';

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
    testEndpoint: '/api/enrich',
    method: 'POST',
    testBody: { url: 'https://example.com/test', dry_run: true },
    envVars: ['ANTHROPIC_API_KEY'],
  },
  {
    id: 'layout',
    name: 'Layout Generator',
    icon: Palette,
    description: 'Moodboard layouts',
    testEndpoint: '/api/layout',
    method: 'POST',
    testBody: { productIds: [], boardSize: { width: 800, height: 600 }, dry_run: true },
    envVars: [],
  },
  {
    id: 'smart-labels',
    name: 'Smart Labels',
    icon: FileText,
    description: 'AI label placement',
    testEndpoint: '/api/smart-labels',
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

// Common debug issues
const DEBUG_ISSUES = [
  {
    id: 'cors',
    title: 'CORS Errors',
    symptoms: ['Request blocked by CORS policy', 'No Access-Control-Allow-Origin header'],
    solutions: [
      'Check vercel.json has correct CORS headers',
      'Ensure API_URL matches deployed backend URL',
      'Verify frontend domain is in allowed origins',
    ],
    commands: ['curl -I {API_URL}/api/search'],
  },
  {
    id: '404',
    title: 'API 404 Errors',
    symptoms: ['Endpoint returns 404', 'Route not found'],
    solutions: [
      'Verify file exists in backend/api/ folder',
      'Check vercel.json function patterns match',
      'Redeploy backend with --force flag',
      'Check Vercel dashboard for build errors',
    ],
    commands: ['cd backend && vercel --prod --force'],
  },
  {
    id: 'env',
    title: 'Missing Environment Variables',
    symptoms: ['undefined API key', 'Connection failed', 'Auth error'],
    solutions: [
      'Check Vercel dashboard → Settings → Environment Variables',
      'Ensure variables are set for Production environment',
      'Redeploy after adding new env vars',
    ],
    commands: ['vercel env ls'],
  },
  {
    id: 'supabase',
    title: 'Supabase Connection Issues',
    symptoms: ['Database connection failed', 'Auth not working', 'RLS policy error'],
    solutions: [
      'Verify SUPABASE_URL and SUPABASE_KEY are correct',
      'Check if using anon key (frontend) vs service key (backend)',
      'Review Row Level Security policies in Supabase dashboard',
    ],
    commands: [],
  },
  {
    id: 'ai',
    title: 'AI/Claude API Issues',
    symptoms: ['Enrichment failed', 'Rate limit exceeded', 'Invalid API key'],
    solutions: [
      'Verify ANTHROPIC_API_KEY is set in Vercel/Supabase',
      'Check API usage limits in Anthropic console',
      'Ensure Edge Function secrets are configured',
    ],
    commands: [],
  },
  {
    id: 'shopify-oauth',
    title: 'Shopify OAuth Issues',
    symptoms: ['OAuth redirect fails', 'Invalid HMAC', 'Token not stored'],
    solutions: [
      'Verify APP_URL matches your Vercel deployment',
      'Check SHOPIFY_SECRET matches Partner Dashboard',
      'Ensure callback URL is whitelisted in Shopify app settings',
    ],
    commands: [],
  },
];

// Dev commands
const DEV_COMMANDS = [
  {
    category: 'Frontend',
    commands: [
      { name: 'Start Dev Server', cmd: 'cd frontend && npm run dev', description: 'Runs on localhost:3000' },
      { name: 'Build', cmd: 'cd frontend && npm run build', description: 'Production build' },
      { name: 'Run Tests', cmd: 'cd frontend && npm test', description: 'Jest tests' },
    ],
  },
  {
    category: 'Backend',
    commands: [
      { name: 'Start Dev Server', cmd: 'cd backend && vercel dev', description: 'Local Vercel dev' },
      { name: 'Deploy', cmd: 'cd backend && vercel --prod', description: 'Deploy to production' },
      { name: 'Force Deploy', cmd: 'cd backend && vercel --prod --force', description: 'Clear cache & deploy' },
      { name: 'Run Tests', cmd: 'cd backend && npm test', description: 'Vitest tests' },
    ],
  },
  {
    category: 'Database',
    commands: [
      { name: 'Run Migration', cmd: 'cd backend && node scripts/run-migration.js', description: 'Apply SQL migrations' },
      { name: 'Populate URLs', cmd: 'cd backend && node scripts/populate-product-urls.js', description: 'Generate product URLs' },
    ],
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'shopify' | 'debug' | 'commands'>('health');
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatus[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

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

  // Load cached test results on mount
  useEffect(() => {
    const cached = loadCachedStatus();
    if (cached.length > 0) {
      setIntegrationStatuses(cached);
    }
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
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'OPTIONS',
      });
      setBackendRunning(response.ok || response.status === 204);
    } catch {
      setBackendRunning(false);
    }
  };

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

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 2000);
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
          { id: 'debug', label: 'Debug', icon: Bug },
          { id: 'commands', label: 'Commands', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--foreground)' : 'var(--foreground-muted)',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-6">
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
              <button
                onClick={testAllIntegrations}
                disabled={isTestingAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              >
                <RefreshCw size={14} className={isTestingAll ? 'animate-spin' : ''} />
                Re-test
              </button>
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
              <button
                onClick={testAllIntegrations}
                disabled={isTestingAll}
                className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              >
                {isTestingAll ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                Test All
              </button>
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
                      <button
                        onClick={() => testSingleIntegration(integration.id)}
                        disabled={isTesting}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                        title="Re-test this integration"
                      >
                        <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
                        Test
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
                <button
                  onClick={connectToShopify}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  Connect Store
                </button>
                <button
                  onClick={checkStatus}
                  disabled={isCheckingStatus}
                  className="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  style={{ backgroundColor: 'var(--surface-light)', color: 'var(--foreground)' }}
                >
                  {isCheckingStatus ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Check Status
                </button>
                <button
                  onClick={syncProducts}
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  style={{ backgroundColor: 'var(--surface-light)', color: 'var(--foreground)' }}
                >
                  {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                  Sync Products
                </button>
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

      {/* Debug Tab */}
      {activeTab === 'debug' && (
        <div className="space-y-4">
          <section
            className="rounded-lg border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}>
                  <Bug size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    Common Issues & Solutions
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                    Quick fixes for typical problems
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {DEBUG_ISSUES.map((issue) => (
                <div key={issue.id} className="p-4">
                  <button
                    onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={18} style={{ color: 'var(--warning, #f59e0b)' }} />
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {issue.title}
                      </span>
                    </div>
                    {expandedIssue === issue.id ? (
                      <ChevronDown size={18} style={{ color: 'var(--foreground-muted)' }} />
                    ) : (
                      <ChevronRight size={18} style={{ color: 'var(--foreground-muted)' }} />
                    )}
                  </button>

                  {expandedIssue === issue.id && (
                    <div className="mt-4 space-y-4 pl-9">
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--foreground-muted)' }}>
                          Symptoms:
                        </p>
                        <ul className="space-y-1">
                          {issue.symptoms.map((s, i) => (
                            <li
                              key={i}
                              className="text-sm flex items-start gap-2"
                              style={{ color: 'var(--foreground-secondary)' }}
                            >
                              <span style={{ color: 'var(--error)' }}>•</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--foreground-muted)' }}>
                          Solutions:
                        </p>
                        <ol className="space-y-1">
                          {issue.solutions.map((s, i) => (
                            <li
                              key={i}
                              className="text-sm flex items-start gap-2"
                              style={{ color: 'var(--foreground)' }}
                            >
                              <span className="font-medium" style={{ color: 'var(--primary)' }}>
                                {i + 1}.
                              </span>
                              {s}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {issue.commands.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2" style={{ color: 'var(--foreground-muted)' }}>
                            Commands:
                          </p>
                          {issue.commands.map((cmd, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 rounded text-sm font-mono"
                              style={{ backgroundColor: 'var(--background)' }}
                            >
                              <code style={{ color: 'var(--foreground)' }}>
                                {cmd.replace('{API_URL}', API_URL)}
                              </code>
                              <button
                                onClick={() => copyCommand(cmd.replace('{API_URL}', API_URL))}
                                className="p-1 rounded hover:bg-[var(--surface-light)]"
                              >
                                {copiedCommand === cmd.replace('{API_URL}', API_URL) ? (
                                  <Check size={14} style={{ color: 'var(--success)' }} />
                                ) : (
                                  <Copy size={14} style={{ color: 'var(--foreground-muted)' }} />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Commands Tab */}
      {activeTab === 'commands' && (
        <div className="space-y-6">
          {/* Local Dev Note */}
          <div
            className="p-4 rounded-lg flex items-start gap-3"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
          >
            <Info size={20} style={{ color: 'rgb(59, 130, 246)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                About Local Development
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--foreground-secondary)' }}>
                The frontend runs locally via <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background)' }}>npm run dev</code> and cannot be started from this dashboard.
                Use your terminal to run these commands. The backend can be run locally with <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background)' }}>vercel dev</code> or deployed to Vercel.
              </p>
            </div>
          </div>

          {DEV_COMMANDS.map((category) => (
            <section
              key={category.category}
              className="rounded-lg border"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div
                className="p-4 border-b flex items-center gap-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}>
                  <Terminal size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {category.category}
                </h2>
              </div>

              <div className="p-4 space-y-3">
                {category.commands.map((cmd, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--surface-light)' }}
                  >
                    <div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                        {cmd.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {cmd.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground-secondary)' }}
                      >
                        {cmd.cmd}
                      </code>
                      <button
                        onClick={() => copyCommand(cmd.cmd)}
                        className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
                      >
                        {copiedCommand === cmd.cmd ? (
                          <Check size={16} style={{ color: 'var(--success)' }} />
                        ) : (
                          <Copy size={16} style={{ color: 'var(--foreground-muted)' }} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Quick Links */}
          <section
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="font-medium mb-3" style={{ color: 'var(--foreground)' }}>
              Quick Links
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Vercel Dashboard', url: 'https://vercel.com/dashboard' },
                { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard' },
                { label: 'Shopify Partners', url: 'https://partners.shopify.com' },
                { label: 'Anthropic Console', url: 'https://console.anthropic.com' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ backgroundColor: 'var(--surface-light)', color: 'var(--foreground)' }}
                >
                  <ExternalLink size={14} />
                  {link.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
