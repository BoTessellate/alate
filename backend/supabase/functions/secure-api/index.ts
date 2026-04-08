/**
 * Secure API Edge Function
 *
 * Provides authenticated access to database operations and external APIs.
 * All requests require a valid API secret header.
 *
 * Features:
 * - Secret header validation (X-API-Secret)
 * - Supabase database operations (insert/update/delete)
 * - Pinecone vector operations
 * - OpenAI/Anthropic API proxying
 * - Audit logging for all operations
 *
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - API_SECRET (for header validation)
 * - PINECONE_API_KEY
 * - PINECONE_INDEX_HOST
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// TYPES
// =============================================================================

interface ApiRequest {
  operation: OperationType;
  table?: string;
  data?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  options?: OperationOptions;
}

type OperationType =
  | 'db_insert'
  | 'db_update'
  | 'db_upsert'
  | 'db_delete'
  | 'db_select'
  | 'pinecone_upsert'
  | 'pinecone_query'
  | 'pinecone_delete'
  | 'openai_embeddings'
  | 'openai_chat'
  | 'anthropic_messages';

interface OperationOptions {
  returning?: boolean;
  onConflict?: string;
  limit?: number;
  orderBy?: { column: string; ascending?: boolean };
  // Pinecone options
  namespace?: string;
  topK?: number;
  includeMetadata?: boolean;
  // AI options
  model?: string;
  maxTokens?: number;
}

interface AuditEntry {
  id?: string;
  operation: string;
  table_name?: string;
  user_id?: string;
  ip_address?: string;
  request_data?: Record<string, unknown>;
  response_status: 'success' | 'error';
  error_message?: string;
  duration_ms: number;
  created_at: string;
}

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  audit_id?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-secret, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Rate limiting (simple in-memory, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const startTime = Date.now();
  let auditEntry: Partial<AuditEntry> = {
    created_at: new Date().toISOString(),
  };

  try {
    // Get client IP for rate limiting and audit
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    auditEntry.ip_address = clientIp;

    // Rate limiting check
    const rateLimitResult = checkRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      return jsonResponse(
        { success: false, error: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter}s` },
        429
      );
    }

    // Validate API secret
    const apiSecret = req.headers.get('x-api-secret');
    const expectedSecret = Deno.env.get('API_SECRET');

    if (!expectedSecret) {
      console.error('[secure-api] API_SECRET not configured');
      return jsonResponse({ success: false, error: 'Server configuration error' }, 500);
    }

    if (!apiSecret || apiSecret !== expectedSecret) {
      auditEntry.response_status = 'error';
      auditEntry.error_message = 'Invalid API secret';
      await writeAuditLog(auditEntry as AuditEntry);

      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Parse request body
    const body: ApiRequest = await req.json();
    auditEntry.operation = body.operation;
    auditEntry.table_name = body.table;
    auditEntry.request_data = sanitizeForAudit(body);

    // Validate operation
    if (!body.operation) {
      return jsonResponse({ success: false, error: 'Operation required' }, 400);
    }

    // Route to appropriate handler
    let result: ApiResponse;

    if (body.operation.startsWith('db_')) {
      result = await handleDatabaseOperation(body);
    } else if (body.operation.startsWith('pinecone_')) {
      result = await handlePineconeOperation(body);
    } else if (body.operation.startsWith('openai_')) {
      result = await handleOpenAIOperation(body);
    } else if (body.operation.startsWith('anthropic_')) {
      result = await handleAnthropicOperation(body);
    } else {
      result = { success: false, error: `Unknown operation: ${body.operation}` };
    }

    // Complete audit entry
    auditEntry.response_status = result.success ? 'success' : 'error';
    auditEntry.error_message = result.error;
    auditEntry.duration_ms = Date.now() - startTime;

    const auditId = await writeAuditLog(auditEntry as AuditEntry);
    result.audit_id = auditId;

    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    console.error('[secure-api] Error:', error);

    auditEntry.response_status = 'error';
    auditEntry.error_message = error instanceof Error ? error.message : 'Unknown error';
    auditEntry.duration_ms = Date.now() - startTime;

    await writeAuditLog(auditEntry as AuditEntry);

    return jsonResponse(
      { success: false, error: 'Internal server error' },
      500
    );
  }
});

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function handleDatabaseOperation(request: ApiRequest): Promise<ApiResponse> {
  const supabase = getSupabaseClient();
  const { operation, table, data, filters, options } = request;

  if (!table) {
    return { success: false, error: 'Table name required for database operations' };
  }

  try {
    let query;

    switch (operation) {
      case 'db_insert':
        if (!data) return { success: false, error: 'Data required for insert' };
        query = supabase.from(table).insert(data);
        if (options?.returning !== false) query = query.select();
        break;

      case 'db_update':
        if (!data) return { success: false, error: 'Data required for update' };
        if (!filters) return { success: false, error: 'Filters required for update' };
        query = supabase.from(table).update(data);
        query = applyFilters(query, filters);
        if (options?.returning !== false) query = query.select();
        break;

      case 'db_upsert':
        if (!data) return { success: false, error: 'Data required for upsert' };
        query = supabase.from(table).upsert(data, {
          onConflict: options?.onConflict,
        });
        if (options?.returning !== false) query = query.select();
        break;

      case 'db_delete':
        if (!filters) return { success: false, error: 'Filters required for delete' };
        query = supabase.from(table).delete();
        query = applyFilters(query, filters);
        break;

      case 'db_select':
        query = supabase.from(table).select('*');
        if (filters) query = applyFilters(query, filters);
        if (options?.limit) query = query.limit(options.limit);
        if (options?.orderBy) {
          query = query.order(options.orderBy.column, {
            ascending: options.orderBy.ascending ?? true,
          });
        }
        break;

      default:
        return { success: false, error: `Unknown database operation: ${operation}` };
    }

    const { data: result, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database operation failed',
    };
  }
}

function applyFilters(query: any, filters: Record<string, unknown>): any {
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'object' && value !== null) {
      // Handle operators: { column: { eq: value } }
      const ops = value as Record<string, unknown>;
      for (const [op, val] of Object.entries(ops)) {
        switch (op) {
          case 'eq':
            query = query.eq(key, val);
            break;
          case 'neq':
            query = query.neq(key, val);
            break;
          case 'gt':
            query = query.gt(key, val);
            break;
          case 'gte':
            query = query.gte(key, val);
            break;
          case 'lt':
            query = query.lt(key, val);
            break;
          case 'lte':
            query = query.lte(key, val);
            break;
          case 'like':
            query = query.like(key, val);
            break;
          case 'ilike':
            query = query.ilike(key, val);
            break;
          case 'in':
            query = query.in(key, val as unknown[]);
            break;
          case 'is':
            query = query.is(key, val);
            break;
        }
      }
    } else {
      // Simple equality
      query = query.eq(key, value);
    }
  }
  return query;
}

// =============================================================================
// PINECONE OPERATIONS
// =============================================================================

async function handlePineconeOperation(request: ApiRequest): Promise<ApiResponse> {
  const pineconeApiKey = Deno.env.get('PINECONE_API_KEY');
  const pineconeHost = Deno.env.get('PINECONE_INDEX_HOST');

  if (!pineconeApiKey || !pineconeHost) {
    return { success: false, error: 'Pinecone not configured' };
  }

  const { operation, data, options } = request;
  const namespace = options?.namespace || '';

  try {
    switch (operation) {
      case 'pinecone_upsert': {
        if (!data || !Array.isArray(data.vectors)) {
          return { success: false, error: 'Vectors array required for upsert' };
        }

        const response = await fetch(`${pineconeHost}/vectors/upsert`, {
          method: 'POST',
          headers: {
            'Api-Key': pineconeApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vectors: data.vectors,
            namespace,
          }),
        });

        const result = await response.json();
        return { success: response.ok, data: result };
      }

      case 'pinecone_query': {
        if (!data || !data.vector) {
          return { success: false, error: 'Vector required for query' };
        }

        const response = await fetch(`${pineconeHost}/query`, {
          method: 'POST',
          headers: {
            'Api-Key': pineconeApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vector: data.vector,
            topK: options?.topK || 10,
            includeMetadata: options?.includeMetadata ?? true,
            namespace,
          }),
        });

        const result = await response.json();
        return { success: response.ok, data: result };
      }

      case 'pinecone_delete': {
        if (!data || (!data.ids && !data.deleteAll)) {
          return { success: false, error: 'IDs or deleteAll flag required for delete' };
        }

        const response = await fetch(`${pineconeHost}/vectors/delete`, {
          method: 'POST',
          headers: {
            'Api-Key': pineconeApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ids: data.ids,
            deleteAll: data.deleteAll,
            namespace,
          }),
        });

        const result = await response.json();
        return { success: response.ok, data: result };
      }

      default:
        return { success: false, error: `Unknown Pinecone operation: ${operation}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Pinecone operation failed',
    };
  }
}

// =============================================================================
// OPENAI OPERATIONS
// =============================================================================

async function handleOpenAIOperation(request: ApiRequest): Promise<ApiResponse> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  if (!openaiApiKey) {
    return { success: false, error: 'OpenAI not configured' };
  }

  const { operation, data, options } = request;

  try {
    switch (operation) {
      case 'openai_embeddings': {
        if (!data || !data.input) {
          return { success: false, error: 'Input text required for embeddings' };
        }

        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: options?.model || 'text-embedding-3-small',
            input: data.input,
          }),
        });

        const result = await response.json();
        return { success: response.ok, data: result };
      }

      case 'openai_chat': {
        if (!data || !data.messages) {
          return { success: false, error: 'Messages required for chat' };
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: options?.model || 'gpt-4o',
            messages: data.messages,
            max_tokens: options?.maxTokens || 1024,
          }),
        });

        const result = await response.json();
        return { success: response.ok, data: result };
      }

      default:
        return { success: false, error: `Unknown OpenAI operation: ${operation}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OpenAI operation failed',
    };
  }
}

// =============================================================================
// ANTHROPIC OPERATIONS
// =============================================================================

async function handleAnthropicOperation(request: ApiRequest): Promise<ApiResponse> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!anthropicApiKey) {
    return { success: false, error: 'Anthropic not configured' };
  }

  const { operation, data, options } = request;

  try {
    switch (operation) {
      case 'anthropic_messages': {
        if (!data || !data.messages) {
          return { success: false, error: 'Messages required for Anthropic' };
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: options?.model || 'claude-3-5-haiku-20241022',
            messages: data.messages,
            max_tokens: options?.maxTokens || 1024,
          }),
        });

        const result = await response.json();
        return { success: response.ok, data: result };
      }

      default:
        return { success: false, error: `Unknown Anthropic operation: ${operation}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Anthropic operation failed',
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function writeAuditLog(entry: AuditEntry): Promise<string | undefined> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('api_audit_log')
      .insert({
        operation: entry.operation,
        table_name: entry.table_name,
        user_id: entry.user_id,
        ip_address: entry.ip_address,
        request_data: entry.request_data,
        response_status: entry.response_status,
        error_message: entry.error_message,
        duration_ms: entry.duration_ms,
        created_at: entry.created_at,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[secure-api] Audit log error:', error);
      return undefined;
    }

    return data?.id;
  } catch (error) {
    console.error('[secure-api] Audit log error:', error);
    return undefined;
  }
}

function sanitizeForAudit(data: unknown): Record<string, unknown> {
  // Remove sensitive fields before logging
  const sanitized = JSON.parse(JSON.stringify(data));

  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'api_key',
    'apiKey',
    'access_token',
    'accessToken',
    'authorization',
  ];

  function redact(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redact(obj[key] as Record<string, unknown>);
      }
    }
  }

  if (typeof sanitized === 'object' && sanitized !== null) {
    redact(sanitized);
  }

  return sanitized;
}

function checkRateLimit(clientIp: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
