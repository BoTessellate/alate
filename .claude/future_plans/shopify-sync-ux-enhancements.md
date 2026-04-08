# Shopify Sync Architecture Enhancements

## Overview

Enhance the Shopify sync system with 4 key improvements:
1. **Real-time progress indication** (polling-based)
2. **Per-product error details + retry UI**
3. **Expanded sync history with error details**
4. **Sync cancellation support**

**Priority**: Medium - core functionality only, no polish
**Documentation**: Unimplemented features documented in code as TODOs

---

## Current Architecture

### Backend Flow
- [backend/api/shopify.ts:696-826](backend/api/shopify.ts) - `handleSync()` POST endpoint
- [backend/sdk/shopify/sync.ts:417-570](backend/sdk/shopify/sync.ts) - `syncShopProducts()` core logic
- Progress callback exists (line 411) but not exposed to frontend

### Frontend Flow
- [frontend/src/app/admin/components/ShopifyTab.tsx:81-113](frontend/src/app/admin/components/ShopifyTab.tsx) - `syncProducts()` makes single POST, waits for completion
- No progress indication (just spinner)
- No error details displayed

### Database
- `shopify_sync_logs` table stores:
  - `sync_id`, `shop_domain`, `status`, `products_synced/enriched/failed`
  - `error_details` JSONB (already stores per-product errors!)
  - `duration_ms`, `started_at`, `completed_at`

---

## Implementation Plan

### Phase 1: Backend - Add Sync Status Endpoint ✅

**File**: [backend/api/shopify.ts](backend/api/shopify.ts)

**Add new action handler** after line 652 (existing `handleStatus`):

```typescript
// ============================================================================
// Sync Status Polling (for real-time progress)
// ============================================================================
async function handleSyncStatus(req: VercelRequest, res: VercelResponse) {
  const syncId = req.query.sync_id as string;

  if (!syncId) {
    return res.status(400).json({ error: 'Missing sync_id parameter' });
  }

  const supabase = getSupabase();
  const { data: log, error } = await supabase
    .from('shopify_sync_logs')
    .select('*')
    .eq('sync_id', syncId)
    .single();

  if (error || !log) {
    return res.status(404).json({ error: 'Sync not found' });
  }

  return res.json({
    sync_id: log.sync_id,
    status: log.status, // 'started' | 'completed' | 'failed' | 'cancelled'
    products_synced: log.products_synced || 0,
    products_enriched: log.products_enriched || 0,
    products_failed: log.products_failed || 0,
    duration_ms: log.duration_ms || (Date.now() - new Date(log.started_at).getTime()),
    error_details: log.error_details,
  });
}
```

**Update main handler** (line 163) to route `sync-status` action:

```typescript
case 'sync-status':
  return await handleSyncStatus(req, res);
```

**Why polling instead of SSE/WebSocket?**
- Medium priority = simpler implementation
- Polling works with Vercel serverless (no persistent connections)
- Can upgrade to SSE later (add TODO comment)

---

### Phase 2: Backend - Add Sync Cancellation Support ✅

**File**: [backend/api/shopify.ts](backend/api/shopify.ts)

**Add new action handler**:

```typescript
// ============================================================================
// Sync Cancellation
// ============================================================================
async function handleSyncCancel(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sync_id } = req.body;

  if (!sync_id) {
    return res.status(400).json({ error: 'Missing sync_id parameter' });
  }

  const supabase = getSupabase();

  // Check if sync is still running
  const { data: log } = await supabase
    .from('shopify_sync_logs')
    .select('status')
    .eq('sync_id', sync_id)
    .single();

  if (!log) {
    return res.status(404).json({ error: 'Sync not found' });
  }

  if (log.status !== 'started') {
    return res.status(400).json({
      error: 'Sync already completed',
      status: log.status
    });
  }

  // Mark as cancelled (actual abort handled by timeout)
  await supabase
    .from('shopify_sync_logs')
    .update({
      status: 'cancelled',
      completed_at: getISTTimestamp(),
      duration_ms: Date.now() - new Date(log.started_at).getTime(),
    })
    .eq('sync_id', sync_id);

  return res.json({ success: true, sync_id });
}
```

**Update main handler** to route `sync-cancel` action.

**Add TODO comment** for future improvement:
```typescript
// TODO: Implement AbortController in syncShopProducts() for graceful cancellation
// Currently relies on Vercel timeout. For proper cancellation:
// 1. Pass AbortSignal to syncShopProducts()
// 2. Check signal.aborted between stages (fetch, transform, enrich, save)
// 3. Throw AbortError if cancelled
// 4. Clean up partial data in catch block
```

---

### Phase 3: Frontend - Progress Polling UI ✅

**File**: [frontend/src/app/admin/components/ShopifyTab.tsx](frontend/src/app/admin/components/ShopifyTab.tsx)

**Add state** (after line 23):

```typescript
const [syncProgress, setSyncProgress] = useState<{
  stage: string;
  current: number;
  total: number;
  percentage: number;
} | null>(null);
const [activeSyncId, setActiveSyncId] = useState<string | null>(null);
```

**Add polling function**:

```typescript
const pollSyncStatus = async (syncId: string) => {
  const response = await fetch(`${apiUrl}/api/shopify?action=sync-status&sync_id=${syncId}`);
  const data = await response.json();

  // Estimate progress based on counts
  // TODO: Backend should track current stage (fetch/transform/enrich/save)
  // and provide progress.stage, progress.current, progress.total
  const total = data.products_synced + data.products_enriched;
  const percentage = total > 0 ? Math.min(100, (data.products_synced / total) * 100) : 0;

  setSyncProgress({
    stage: data.status === 'started' ? 'Processing...' : data.status,
    current: data.products_synced,
    total: total || 100, // fallback
    percentage,
  });

  return data.status; // 'started' | 'completed' | 'failed' | 'cancelled'
};
```

**Update `syncProducts()`** (line 81-113):

```typescript
const syncProducts = async () => {
  if (!shopDomain) {
    setError('Please enter a shop domain');
    return;
  }
  setIsSyncing(true);
  setError(null);
  setSyncResult(null);
  setSyncProgress(null);

  try {
    const response = await fetch(`${apiUrl}/api/shopify?action=sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop: shopDomain }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    // Start polling for progress
    if (data.sync_id) {
      setActiveSyncId(data.sync_id);

      const pollInterval = setInterval(async () => {
        const status = await pollSyncStatus(data.sync_id);

        if (status !== 'started') {
          clearInterval(pollInterval);
          setActiveSyncId(null);
          setSyncProgress(null);
        }
      }, 500); // Poll every 500ms

      // Stop polling after 2 minutes (Vercel timeout)
      setTimeout(() => {
        clearInterval(pollInterval);
        setActiveSyncId(null);
      }, 120000);
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
```

**Add progress UI** (before line 196 - sync result display):

```typescript
{/* Progress Indicator */}
{isSyncing && syncProgress && (
  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
    <div className="flex items-center gap-3 mb-2">
      <RefreshCw className="animate-spin" size={16} style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--foreground)' }}>{syncProgress.stage}</span>
    </div>
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
      <div
        className="h-full transition-all duration-300"
        style={{
          backgroundColor: 'var(--primary)',
          width: `${syncProgress.percentage}%`
        }}
      />
    </div>
    <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
      {syncProgress.current} / {syncProgress.total} products
    </p>
  </div>
)}
```

**Add TODO comment** for future improvement:
```typescript
// TODO: Enhance progress tracking with stage-specific details
// Backend should expose: current_stage ('fetch' | 'transform' | 'enrich' | 'save')
// Then show: "Fetching products from Shopify... 45/200"
//            "Enriching with AI... 30/200"
```

---

### Phase 4: Frontend - Sync Cancellation UI ✅

**File**: [frontend/src/app/admin/components/ShopifyTab.tsx](frontend/src/app/admin/components/ShopifyTab.tsx)

**Add cancel function**:

```typescript
const cancelSync = async () => {
  if (!activeSyncId) return;

  try {
    const response = await fetch(`${apiUrl}/api/shopify?action=sync-cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sync_id: activeSyncId }),
    });

    const data = await response.json();

    if (response.ok) {
      setActiveSyncId(null);
      setSyncProgress(null);
      setIsSyncing(false);
      setSyncResult({ success: false, message: 'Sync cancelled by user' });
    } else {
      setError(data.error || 'Failed to cancel sync');
    }
  } catch (err) {
    setError('Failed to cancel sync');
  }
};
```

**Add cancel button** (in progress UI from Phase 3):

```typescript
{/* Progress Indicator with Cancel */}
{isSyncing && syncProgress && (
  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <RefreshCw className="animate-spin" size={16} style={{ color: 'var(--primary)' }} />
        <span style={{ color: 'var(--foreground)' }}>{syncProgress.stage}</span>
      </div>
      {activeSyncId && (
        <Button
          variant="secondary"
          onClick={cancelSync}
          size="sm"
        >
          Cancel
        </Button>
      )}
    </div>
    {/* ... rest of progress UI ... */}
  </div>
)}
```

**Add TODO comment**:
```typescript
// TODO: Implement graceful cancellation with AbortController
// Currently marks sync as 'cancelled' in DB but doesn't stop backend processing
// For true cancellation, backend needs to check abort signal between stages
```

---

### Phase 5: Frontend - Expanded Sync History ✅

**File**: [frontend/src/app/admin/components/ShopifyTab.tsx](frontend/src/app/admin/components/ShopifyTab.tsx)

**Add state** (after line 23):

```typescript
const [expandedSyncId, setExpandedSyncId] = useState<string | null>(null);
```

**Update sync history display** (lines 243-269 - "Recent Syncs" section):

```typescript
{/* Recent Syncs - Enhanced */}
{shopifyStatus?.recent_syncs && shopifyStatus.recent_syncs.length > 0 && (
  <div className="mt-4">
    <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
      Recent Syncs
    </h3>
    <div className="space-y-2">
      {shopifyStatus.recent_syncs.map((sync: any, idx: number) => {
        const isExpanded = expandedSyncId === sync.sync_id;
        const hasErrors = sync.error_details?.errors?.length > 0;

        return (
          <div
            key={idx}
            className="p-3 rounded border cursor-pointer hover:border-[var(--primary)]"
            style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
            onClick={() => setExpandedSyncId(isExpanded ? null : sync.sync_id)}
          >
            {/* Summary Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sync.status === 'completed' ? (
                  <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                ) : sync.status === 'failed' ? (
                  <XCircle size={16} style={{ color: 'var(--error)' }} />
                ) : sync.status === 'cancelled' ? (
                  <AlertCircle size={16} style={{ color: 'var(--foreground-muted)' }} />
                ) : (
                  <RefreshCw size={16} style={{ color: 'var(--primary)' }} />
                )}
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                  {new Date(sync.started_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                <span>{sync.products_synced || 0} synced</span>
                {sync.products_enriched > 0 && <span>{sync.products_enriched} enriched</span>}
                {hasErrors && <span style={{ color: 'var(--error)' }}>{sync.error_details.errors.length} errors</span>}
                {sync.duration_ms && <span>{(sync.duration_ms / 1000).toFixed(1)}s</span>}
              </div>
            </div>

            {/* Expanded Error Details */}
            {isExpanded && hasErrors && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--foreground-muted)' }}>
                  Error Details:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sync.error_details.errors.map((err: any, errIdx: number) => (
                    <div
                      key={errIdx}
                      className="p-2 rounded text-xs"
                      style={{ backgroundColor: 'rgba(168, 64, 50, 0.1)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono" style={{ color: 'var(--error)' }}>
                          {err.product_id || 'Unknown'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px]" style={{
                          backgroundColor: 'var(--surface)',
                          color: 'var(--foreground-muted)'
                        }}>
                          {err.stage}
                        </span>
                      </div>
                      <p style={{ color: 'var(--foreground-secondary)' }}>
                        {err.error}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

---

### Phase 6: Frontend - Retry Failed Products UI ✅

**File**: [frontend/src/app/admin/components/ShopifyTab.tsx](frontend/src/app/admin/components/ShopifyTab.tsx)

**Add retry function**:

```typescript
const retryFailedProducts = async (syncId: string) => {
  // Find the sync in recent syncs
  const sync = shopifyStatus?.recent_syncs?.find((s: any) => s.sync_id === syncId);
  if (!sync || !sync.error_details?.errors?.length) {
    setError('No failed products to retry');
    return;
  }

  // Extract product IDs from errors
  const failedProductIds = sync.error_details.errors
    .map((err: any) => err.product_id)
    .filter((id: string) => id); // Remove empty IDs

  if (failedProductIds.length === 0) {
    setError('No product IDs found in errors');
    return;
  }

  setIsSyncing(true);
  setError(null);
  setSyncResult(null);

  try {
    const response = await fetch(`${apiUrl}/api/shopify?action=sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop: shopDomain,
        product_ids: failedProductIds,
        skip_enrichment: true, // Faster retry
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    setSyncResult({
      ...data,
      message: `Retried ${failedProductIds.length} failed products`,
    });

    // Refresh status to show updated sync history
    await checkStatus();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Retry failed');
  } finally {
    setIsSyncing(false);
  }
};
```

**Add retry button** (in expanded sync history UI):

```typescript
{/* Expanded Error Details with Retry Button */}
{isExpanded && hasErrors && (
  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
        Error Details:
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation(); // Prevent collapse
          retryFailedProducts(sync.sync_id);
        }}
        disabled={isSyncing}
      >
        Retry Failed ({sync.error_details.errors.length})
      </Button>
    </div>
    {/* ... error list ... */}
  </div>
)}
```

**Add TODO comment**:
```typescript
// TODO: Track retry attempts per product in database
// Add 'retry_count' field to error_details to prevent infinite retry loops
// Show "Retried 2x" badge for products that failed multiple times
```

---

## Documentation for Future Enhancements

**File**: [backend/sdk/shopify/sync.ts](backend/sdk/shopify/sync.ts)

Add comment block before `syncShopProducts()` function (line 414):

```typescript
/**
 * Sync products from a Shopify store
 *
 * POTENTIAL ENHANCEMENTS (not yet implemented):
 *
 * 1. Granular Progress Tracking
 *    - Expose current stage name ('fetch' | 'transform' | 'enrich' | 'save')
 *    - Track progress per stage (e.g. "Enriching 45/200")
 *    - Store stage timings in database for performance analysis
 *
 * 2. Graceful Cancellation with AbortController
 *    - Accept AbortSignal parameter
 *    - Check signal.aborted between stages and batch operations
 *    - Clean up partial data on abort (e.g. delete unsaved products)
 *    - Return partial success result (products synced before abort)
 *
 * 3. Selective Sync with Filters
 *    - Filter by product category, vendor, or tags
 *    - Filter by date_modified (sync only updated products)
 *    - Filter by inventory status (sync only in-stock products)
 *
 * 4. Configurable Batch Sizes
 *    - Allow custom enrichment batch size (currently hardcoded to 5)
 *    - Allow custom save batch size (currently saves all at once)
 *    - Balance between speed and API rate limits
 *
 * 5. Retry Logic for Individual Products
 *    - Track retry count per product in error_details
 *    - Exponential backoff for transient errors (rate limits, network)
 *    - Skip products that fail 3+ times (permanent errors)
 *
 * 6. Enrichment-Only Sync Mode
 *    - Re-enrich existing products without fetching from Shopify
 *    - Useful for updating AI metadata after model improvements
 *    - Filter by enrichment_status = null or enrichment_quality < threshold
 *
 * 7. Real-Time Progress via Server-Sent Events (SSE)
 *    - Replace polling with SSE for instant progress updates
 *    - Stream stage changes, product counts, errors as they happen
 *    - Requires persistent connection (not supported on Vercel Hobby)
 *
 * 8. Detailed Stage Timings
 *    - Store timing breakdown per stage in database
 *    - Display in UI: "Fetch: 12s | Transform: 2s | Enrich: 45s | Save: 3s"
 *    - Identify bottlenecks for optimization
 *
 * 9. Partial Sync Resume
 *    - If sync fails mid-way, resume from last completed stage
 *    - Store checkpoint state in database (last_processed_product_index)
 *    - Useful for large catalogs (500+ products)
 *
 * 10. Sync Scheduling and Automation
 *     - Cron job to auto-sync every N hours
 *     - Trigger sync on Shopify webhook (product.create, product.update)
 *     - Notify admin on sync completion via email/Slack
 */
export async function syncShopProducts(
  shopDomain: string,
  options: SyncOptions
): Promise<SyncResult> {
  // ... existing implementation ...
}
```

---

## Critical Files to Modify

### Backend
- ✅ [backend/api/shopify.ts](backend/api/shopify.ts)
  - Add `handleSyncStatus()` action handler
  - Add `handleSyncCancel()` action handler
  - Route new actions in main handler (line 163)

### Frontend
- ✅ [frontend/src/app/admin/components/ShopifyTab.tsx](frontend/src/app/admin/components/ShopifyTab.tsx)
  - Add progress polling state + UI
  - Add cancel sync function + button
  - Expand sync history with error details
  - Add retry failed products function + button

### Database
- ✅ No schema changes needed (error_details JSONB already exists)
- ✅ Add 'cancelled' as valid status value (code change only, no migration)

---

## Testing Strategy

### Manual Testing Flow

1. **Progress Polling**
   - Start sync with 50+ products
   - Verify progress bar updates every 500ms
   - Check percentage calculation
   - Verify polling stops when sync completes

2. **Cancellation**
   - Start sync, click Cancel button mid-way
   - Verify sync marked as 'cancelled' in database
   - Verify frontend clears progress UI
   - Check that partial products are saved (expected behavior)

3. **Expanded Sync History**
   - Trigger sync with some failed products (disconnect Shopify mid-sync)
   - Click sync row in Recent Syncs
   - Verify error details expand
   - Check error format: product_id, stage, error message

4. **Retry Failed Products**
   - From expanded sync history, click "Retry Failed"
   - Verify POST includes only failed product_ids
   - Verify skip_enrichment=true (faster retry)
   - Check status refreshes after retry completes

### Playwright E2E Tests

**File**: Create `frontend/e2e-playwright/workflows/shopify-sync-enhanced.spec.ts`

```typescript
test.describe('Shopify Sync Enhancements', () => {
  test('should show real-time progress during sync', async ({ page }) => {
    // Start sync
    // Assert progress bar visible
    // Assert percentage increases over time
    // Assert progress UI hidden when sync completes
  });

  test('should cancel running sync', async ({ page }) => {
    // Start sync
    // Click Cancel button
    // Assert sync stops
    // Assert status shows 'cancelled'
  });

  test('should expand sync history to show errors', async ({ page }) => {
    // Click sync row with errors
    // Assert error details visible
    // Assert product IDs and error messages displayed
  });

  test('should retry failed products', async ({ page }) => {
    // Expand sync with errors
    // Click "Retry Failed" button
    // Assert new sync starts with only failed product IDs
    // Assert status refreshes
  });
});
```

---

## Verification Checklist

After implementation, verify:

- [ ] Progress polling endpoint: `GET /api/shopify?action=sync-status&sync_id=...` returns current sync state
- [ ] Cancel endpoint: `POST /api/shopify?action=sync-cancel` with `sync_id` marks sync as cancelled
- [ ] Frontend shows animated progress bar during sync
- [ ] Frontend shows Cancel button during active sync
- [ ] Sync history rows are clickable and expand to show error details
- [ ] "Retry Failed" button appears for syncs with errors
- [ ] Retry triggers new sync with only failed product IDs
- [ ] TODO comments added for unimplemented features (AbortController, SSE, stage tracking)
- [ ] Playwright tests pass for all 4 enhancement areas

---

## Risk Assessment

### Low Risk
- ✅ Expanded sync history (read-only, uses existing data)
- ✅ Retry UI (uses existing sync endpoint with product_ids filter)

### Medium Risk
- ⚠️ Progress polling (adds database load, but minimal with 500ms interval)
- ⚠️ Cancellation (marks as cancelled but doesn't stop backend - needs TODO for proper implementation)

### Known Limitations
- **Polling overhead**: 2 requests/second during sync. Acceptable for single user, may need optimization for multi-user.
- **Cancellation is soft**: Backend continues processing after cancel. Full implementation needs AbortController (documented in TODO).
- **Progress estimation**: Based on product counts, not actual stage progress. Backend enhancement needed for true stage tracking (documented in TODO).

---

## Timeline Estimate

**Note**: No time estimates per project guidelines. Break down into phases to allow for incremental progress.

### Dependency Order
1. Backend endpoints (Phases 1-2) - Must be done first
2. Frontend UI (Phases 3-6) - Can be done in parallel after backend complete
3. Testing - Can be done incrementally alongside implementation
4. Documentation - Add TODOs as features are implemented

---

## Success Criteria

Implementation is complete when:
- ✅ Users see real-time progress during sync (polling-based)
- ✅ Users can cancel long-running syncs (soft cancel, marks as cancelled)
- ✅ Users can click sync history rows to see detailed errors
- ✅ Users can retry failed products without re-syncing everything
- ✅ TODO comments document unimplemented enhancements (AbortController, SSE, stage tracking)
- ✅ Playwright tests verify all 4 enhancement areas
- ✅ No regressions in existing sync functionality
