/**
 * Secure AI Client
 * Routes AI calls through Supabase Edge Function for security
 * API keys remain in Supabase secrets, never exposed to Vercel
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

  try {
    const response = await fetch(secureApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call secure API',
    };
  }
}

/**
 * Call Claude via secure Edge Function
 */
export async function callClaude(
  prompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<{ success: boolean; text?: string; error?: string }> {
  const response = await callSecureAPI({
    operation: 'anthropic_messages',
    data: {
      messages: [{ role: 'user', content: prompt }],
    },
    options: {
      model: options?.model || 'claude-opus-4-5-20251101',
      maxTokens: options?.maxTokens || 1024,
    },
  });

  if (!response.success) {
    return { success: false, error: response.error };
  }

  // Extract text from Anthropic response
  const content = response.data?.content;
  if (content && Array.isArray(content) && content[0]?.type === 'text') {
    return { success: true, text: content[0].text };
  }

  return { success: false, error: 'Invalid response format from Claude' };
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
