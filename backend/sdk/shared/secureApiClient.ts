/**
 * Secure API Client
 *
 * Client SDK for calling the secure Edge Function.
 * All API keys are validated server-side; client only needs the API_SECRET.
 *
 * Usage:
 * ```typescript
 * const client = createSecureApiClient();
 *
 * // Database operations
 * await client.dbInsert('products', { name: 'Product 1' });
 * await client.dbUpdate('products', { name: 'Updated' }, { id: '123' });
 *
 * // Pinecone operations
 * await client.pineconeUpsert([{ id: '1', values: [...], metadata: {...} }]);
 * await client.pineconeQuery(vector, { topK: 10 });
 *
 * // AI operations
 * await client.openaiEmbeddings('Hello world');
 * await client.anthropicMessages([{ role: 'user', content: 'Hello' }]);
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SecureApiConfig {
  /** Edge function URL */
  functionUrl?: string;
  /** API secret for authentication */
  apiSecret?: string;
  /** Request timeout in ms */
  timeout?: number;
}

export interface DbOperationOptions {
  returning?: boolean;
  onConflict?: string;
  limit?: number;
  orderBy?: { column: string; ascending?: boolean };
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface PineconeQueryOptions {
  namespace?: string;
  topK?: number;
  includeMetadata?: boolean;
  filter?: Record<string, unknown>;
}

export interface AiOptions {
  model?: string;
  maxTokens?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  audit_id?: string;
}

// =============================================================================
// SECURE API CLIENT
// =============================================================================

export class SecureApiClient {
  private functionUrl: string;
  private apiSecret: string;
  private timeout: number;

  constructor(config: SecureApiConfig = {}) {
    this.functionUrl =
      config.functionUrl ||
      process.env.SECURE_API_URL ||
      `${process.env.SUPABASE_URL}/functions/v1/secure-api`;

    this.apiSecret = config.apiSecret || process.env.API_SECRET || '';

    this.timeout = config.timeout || 30000;

    if (!this.apiSecret) {
      console.warn('[SecureApiClient] API_SECRET not configured');
    }
  }

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================

  /**
   * Insert a row into a table
   */
  async dbInsert<T = unknown>(
    table: string,
    data: Record<string, unknown>,
    options?: DbOperationOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      operation: 'db_insert',
      table,
      data,
      options,
    });
  }

  /**
   * Update rows in a table
   */
  async dbUpdate<T = unknown>(
    table: string,
    data: Record<string, unknown>,
    filters: Record<string, unknown>,
    options?: DbOperationOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      operation: 'db_update',
      table,
      data,
      filters,
      options,
    });
  }

  /**
   * Upsert (insert or update) a row
   */
  async dbUpsert<T = unknown>(
    table: string,
    data: Record<string, unknown>,
    options?: DbOperationOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      operation: 'db_upsert',
      table,
      data,
      options,
    });
  }

  /**
   * Delete rows from a table
   */
  async dbDelete(
    table: string,
    filters: Record<string, unknown>
  ): Promise<ApiResponse<void>> {
    return this.request<void>({
      operation: 'db_delete',
      table,
      filters,
    });
  }

  /**
   * Select rows from a table
   */
  async dbSelect<T = unknown>(
    table: string,
    filters?: Record<string, unknown>,
    options?: DbOperationOptions
  ): Promise<ApiResponse<T[]>> {
    return this.request<T[]>({
      operation: 'db_select',
      table,
      filters,
      options,
    });
  }

  // ===========================================================================
  // PINECONE OPERATIONS
  // ===========================================================================

  /**
   * Upsert vectors to Pinecone
   */
  async pineconeUpsert(
    vectors: PineconeVector[],
    namespace?: string
  ): Promise<ApiResponse<{ upsertedCount: number }>> {
    return this.request({
      operation: 'pinecone_upsert',
      data: { vectors },
      options: { namespace },
    });
  }

  /**
   * Query vectors in Pinecone
   */
  async pineconeQuery(
    vector: number[],
    options?: PineconeQueryOptions
  ): Promise<ApiResponse<{ matches: Array<{ id: string; score: number; metadata?: unknown }> }>> {
    return this.request({
      operation: 'pinecone_query',
      data: { vector },
      options,
    });
  }

  /**
   * Delete vectors from Pinecone
   */
  async pineconeDelete(
    ids?: string[],
    deleteAll?: boolean,
    namespace?: string
  ): Promise<ApiResponse<void>> {
    return this.request({
      operation: 'pinecone_delete',
      data: { ids, deleteAll },
      options: { namespace },
    });
  }

  // ===========================================================================
  // OPENAI OPERATIONS
  // ===========================================================================

  /**
   * Generate embeddings using OpenAI
   */
  async openaiEmbeddings(
    input: string | string[],
    model?: string
  ): Promise<ApiResponse<{ data: Array<{ embedding: number[]; index: number }> }>> {
    return this.request({
      operation: 'openai_embeddings',
      data: { input },
      options: { model },
    });
  }

  /**
   * Chat completion using OpenAI
   */
  async openaiChat(
    messages: Array<{ role: string; content: string }>,
    options?: AiOptions
  ): Promise<ApiResponse<{ choices: Array<{ message: { content: string } }> }>> {
    return this.request({
      operation: 'openai_chat',
      data: { messages },
      options,
    });
  }

  // ===========================================================================
  // ANTHROPIC OPERATIONS
  // ===========================================================================

  /**
   * Messages using Anthropic Claude
   */
  async anthropicMessages(
    messages: Array<{ role: string; content: string }>,
    options?: AiOptions
  ): Promise<ApiResponse<{ content: Array<{ type: string; text: string }> }>> {
    return this.request({
      operation: 'anthropic_messages',
      data: { messages },
      options,
    });
  }

  // ===========================================================================
  // INTERNAL REQUEST HANDLER
  // ===========================================================================

  private async request<T>(body: Record<string, unknown>): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Secret': this.apiSecret,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || `HTTP ${response.status}`,
          audit_id: result.audit_id,
        };
      }

      return result as ApiResponse<T>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a secure API client instance
 */
export function createSecureApiClient(config?: SecureApiConfig): SecureApiClient {
  return new SecureApiClient(config);
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let defaultClient: SecureApiClient | null = null;

function getDefaultClient(): SecureApiClient {
  if (!defaultClient) {
    defaultClient = createSecureApiClient();
  }
  return defaultClient;
}

// Database operations
export const dbInsert = <T = unknown>(
  table: string,
  data: Record<string, unknown>,
  options?: DbOperationOptions
) => getDefaultClient().dbInsert<T>(table, data, options);

export const dbUpdate = <T = unknown>(
  table: string,
  data: Record<string, unknown>,
  filters: Record<string, unknown>,
  options?: DbOperationOptions
) => getDefaultClient().dbUpdate<T>(table, data, filters, options);

export const dbUpsert = <T = unknown>(
  table: string,
  data: Record<string, unknown>,
  options?: DbOperationOptions
) => getDefaultClient().dbUpsert<T>(table, data, options);

export const dbDelete = (table: string, filters: Record<string, unknown>) =>
  getDefaultClient().dbDelete(table, filters);

export const dbSelect = <T = unknown>(
  table: string,
  filters?: Record<string, unknown>,
  options?: DbOperationOptions
) => getDefaultClient().dbSelect<T>(table, filters, options);

// Pinecone operations
export const pineconeUpsert = (vectors: PineconeVector[], namespace?: string) =>
  getDefaultClient().pineconeUpsert(vectors, namespace);

export const pineconeQuery = (vector: number[], options?: PineconeQueryOptions) =>
  getDefaultClient().pineconeQuery(vector, options);

export const pineconeDelete = (ids?: string[], deleteAll?: boolean, namespace?: string) =>
  getDefaultClient().pineconeDelete(ids, deleteAll, namespace);

// OpenAI operations
export const openaiEmbeddings = (input: string | string[], model?: string) =>
  getDefaultClient().openaiEmbeddings(input, model);

export const openaiChat = (
  messages: Array<{ role: string; content: string }>,
  options?: AiOptions
) => getDefaultClient().openaiChat(messages, options);

// Anthropic operations
export const anthropicMessages = (
  messages: Array<{ role: string; content: string }>,
  options?: AiOptions
) => getDefaultClient().anthropicMessages(messages, options);
