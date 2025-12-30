/**
 * Secure AI Client
 * Routes AI calls through Supabase Edge Function for security
 * Falls back to direct API calls if Edge Function not configured
 *
 * ============================================================================
 * CRITICAL ARCHITECTURE NOTES - DO NOT REMOVE
 * ============================================================================
 *
 * ISSUE #1: Enrichment "stuck in loop" (Dec 2025)
 * -----------------------------------------------
 * Problem: The "Enrich with AI" button in Shopify app would hang indefinitely.
 *
 * Root causes:
 * 1. No timeout on fetch calls - requests could hang forever
 * 2. SECURE_API_URL Edge Function wasn't configured, causing silent failures
 * 3. Using Opus 4.5 model (slow/expensive) for simple enrichment tasks
 *
 * Solution:
 * 1. Added 30-second AbortController timeout on all fetch calls
 * 2. Added fallback to direct Anthropic API when Edge Function not configured
 * 3. Changed default model to Sonnet (faster) via ENRICHMENT_MODEL env var
 *
 * The callClaude() function now:
 * - First tries Edge Function if SECURE_API_URL + API_SECRET are set
 * - Falls back to direct Anthropic API using ANTHROPIC_API_KEY
 * - Both paths have 30-second timeouts
 *
 * Required env vars (at least one set):
 * - Option A: SECURE_API_URL + API_SECRET (routes through Edge Function)
 * - Option B: ANTHROPIC_API_KEY (direct API calls - current setup)
 *
 * DO NOT:
 * - Remove the timeout logic
 * - Remove the direct API fallback
 * - Change default model back to Opus without explicit env var
 * ============================================================================
 */

interface SecureAPIRequest {
  operation: 'anthropic_messages' | 'openai_chat' | 'openai_embeddings';
  data: {
    messages?: Array<{ role: string; content: string }>;
    input?: string;
  };
  options?: {
    model?: string;
    maxTokens?: number;
  };
}

interface SecureAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
  audit_id?: string;
}

/**
 * Call the Supabase secure-api Edge Function
 * This keeps all API keys in Supabase secrets
 */
export async function callSecureAPI(request: SecureAPIRequest): Promise<SecureAPIResponse> {
  const secureApiUrl = process.env.SECURE_API_URL;
  const apiSecret = process.env.API_SECRET;

  if (!secureApiUrl || !apiSecret) {
    return {
      success: false,
      error: 'Secure API not configured. Set SECURE_API_URL and API_SECRET.',
    };
  }

  // Create abort controller with 30 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(secureApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json() as SecureAPIResponse;

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out after 30 seconds',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call secure API',
    };
  }
}

/**
 * Call Anthropic API directly (fallback when Edge Function not configured)
 */
async function callAnthropicDirect(
  prompt: string,
  model: string,
  maxTokens: number
): Promise<{ success: boolean; text?: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: (errorData as any)?.error?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const content = (data as any)?.content;

    if (content && Array.isArray(content) && content[0]?.type === 'text') {
      return { success: true, text: content[0].text };
    }

    return { success: false, error: 'Invalid response format from Claude' };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 30 seconds' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call Anthropic API',
    };
  }
}

/**
 * Call Claude via secure Edge Function or direct API
 * Default model is Sonnet for speed/cost balance
 * Use 'claude-opus-4-5-20251101' for complex reasoning tasks
 */
export async function callClaude(
  prompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<{ success: boolean; text?: string; error?: string }> {
  // Use Claude 3.5 Sonnet by default for faster responses
  // Model options: claude-3-5-sonnet-20241022, claude-sonnet-4-20250514, claude-opus-4-5-20251101
  const defaultModel = process.env.ENRICHMENT_MODEL || 'claude-3-5-sonnet-20241022';
  const model = options?.model || defaultModel;
  const maxTokens = options?.maxTokens || 1024;

  // Try Edge Function first if configured
  const secureApiUrl = process.env.SECURE_API_URL;
  const apiSecret = process.env.API_SECRET;

  if (secureApiUrl && apiSecret) {
    const response = await callSecureAPI({
      operation: 'anthropic_messages',
      data: {
        messages: [{ role: 'user', content: prompt }],
      },
      options: { model, maxTokens },
    });

    if (response.success) {
      const content = response.data?.content;
      if (content && Array.isArray(content) && content[0]?.type === 'text') {
        return { success: true, text: content[0].text };
      }
      return { success: false, error: 'Invalid response format from Claude' };
    }

    // If Edge Function failed, fall through to direct API
    console.warn('[secureAI] Edge Function failed, trying direct API:', response.error);
  }

  // Fallback: Call Anthropic directly
  return callAnthropicDirect(prompt, model, maxTokens);
}

/**
 * Parse JSON from Claude response
 */
export function parseJSONFromResponse(text: string): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Failed to parse
  }
  return null;
}
