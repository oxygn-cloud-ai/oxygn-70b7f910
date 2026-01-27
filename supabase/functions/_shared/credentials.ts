/**
 * Shared Credential Helpers
 * 
 * Provides cross-function access to decrypted credentials
 * while keeping the encryption key isolated in credentials-manager
 */

/**
 * Get decrypted credential via credentials-manager edge function
 * This preserves security by keeping encryption key isolated
 */
export async function getDecryptedCredential(
  authHeader: string,
  service: string,
  key: string
): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  if (!supabaseUrl) {
    console.error('[credentials] SUPABASE_URL not configured');
    return null;
  }
  
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/credentials-manager`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_decrypted', service, key }),
      }
    );
    
    if (!response.ok) {
      console.warn(`[credentials] Failed to get credential: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    // Trim whitespace/newlines from decrypted value to prevent API key issues
    return data.success && data.value ? data.value.trim() : null;
  } catch (error) {
    console.error('[credentials] Error fetching credential:', error);
    return null;
  }
}

/**
 * Get decrypted credential with timeout protection
 * Returns null on timeout or error - NO FALLBACK to env vars
 */
async function getDecryptedCredentialWithTimeout(
  authHeader: string,
  service: string,
  key: string,
  timeoutMs: number = 5000
): Promise<string | null> {
  try {
    const result = await Promise.race<string | null>([
      getDecryptedCredential(authHeader, service, key),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Credential lookup timeout')), timeoutMs)
      )
    ]);
    return result;
  } catch (error) {
    console.warn(`[credentials] Timeout/error fetching ${service}/${key}:`, error);
    return null;
  }
}

/**
 * Get OpenAI API key from user credentials (NO global fallback)
 */
export async function getOpenAIApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'openai', 'api_key');
}

/**
 * Get Gemini API key from user credentials (NO global fallback)
 */
export async function getGeminiApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'gemini', 'api_key');
}

/**
 * Get Manus API key from user credentials (NO global fallback)
 */
export async function getManusApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'manus', 'api_key');
}

/**
 * Get Anthropic API key from user credentials (NO global fallback)
 */
export async function getAnthropicApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'anthropic', 'api_key');
}

/**
 * Get Figma access token from user credentials (NO global fallback)
 */
export async function getFigmaAccessToken(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'figma', 'access_token');
}

/**
 * Check if Manus is configured for a user
 */
export async function isManusConfigured(authHeader: string): Promise<boolean> {
  const apiKey = await getManusApiKey(authHeader);
  return !!apiKey;
}
