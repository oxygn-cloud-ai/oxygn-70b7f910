import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAnthropicApiKey } from "../_shared/credentials.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Edge function to validate a user's Anthropic API key.
 * Tests the key with a minimal request to Claude.
 */
serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', error_code: 'AUTH_MISSING' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token', error_code: 'AUTH_INVALID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Anthropic API key
    const anthropicApiKey = await getAnthropicApiKey(authHeader);
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Anthropic API key not configured', 
          error_code: 'ANTHROPIC_NOT_CONFIGURED',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize the key
    const normalizedKey = anthropicApiKey.trim();
    
    // Warn if unusual format (Anthropic keys typically start with sk-ant)
    if (!normalizedKey.startsWith('sk-ant')) {
      console.warn('[anthropic-key-validate] Unusual key format - proceeding anyway');
    }
    
    // Compute a safe fingerprint (first 8 chars of hex-encoded hash)
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');

    // Get credential metadata from database
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: credentialRow } = await supabase
      .from('user_credentials')
      .select('updated_at')
      .eq('user_id', user.id)
      .eq('service_type', 'anthropic')
      .eq('credential_key', 'api_key')
      .maybeSingle();

    // Test the key with a minimal Anthropic API request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let testResponse: Response;
    try {
      testResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': normalizedKey,
          'anthropic-version': '2024-10-22',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Anthropic API request timed out', 
            error_code: 'ANTHROPIC_TIMEOUT',
            key_length: normalizedKey.length,
            fingerprint: fingerprint,
            updated_at: credentialRow?.updated_at || null
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (testResponse.ok) {
      console.log('[anthropic-key-validate] API key validated successfully');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Anthropic API key is valid',
          key_length: normalizedKey.length,
          fingerprint: fingerprint,
          updated_at: credentialRow?.updated_at || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (testResponse.status === 401) {
      console.log('[anthropic-key-validate] Invalid API key');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid API key - Anthropic rejected the configured key',
          error_code: 'ANTHROPIC_INVALID_KEY',
          key_length: normalizedKey.length,
          fingerprint: fingerprint,
          updated_at: credentialRow?.updated_at || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorText = await testResponse.text();
    console.log('[anthropic-key-validate] API error:', testResponse.status, errorText);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Anthropic API error: ${errorText}`,
        error_code: 'ANTHROPIC_API_ERROR',
        anthropic_status: testResponse.status,
        key_length: normalizedKey.length,
        fingerprint: fingerprint,
        updated_at: credentialRow?.updated_at || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[anthropic-key-validate] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
