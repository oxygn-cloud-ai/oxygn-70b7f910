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
 * Get Manus API key - tries user credential first, falls back to env var
 */
export async function getManusApiKey(
  authHeader: string
): Promise<string | null> {
  // Try user-specific credential first
  const userKey = await getDecryptedCredential(authHeader, 'manus', 'api_key');
  if (userKey) return userKey;
  
  // Fallback to environment variable (for shared/admin usage)
  return Deno.env.get('MANUS_API_KEY') || null;
}

/**
 * Check if Manus is configured for a user
 */
export async function isManusConfigured(authHeader: string): Promise<boolean> {
  const apiKey = await getManusApiKey(authHeader);
  return !!apiKey;
}
