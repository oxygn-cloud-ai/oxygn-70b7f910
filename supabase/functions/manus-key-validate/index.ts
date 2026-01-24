import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getManusApiKey } from "../_shared/credentials.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Edge function to validate a user's Manus API key without creating a task.
 * Returns key metadata (fingerprint, length, updated_at) but never the actual key.
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

    // Get Manus API key
    const manusApiKey = await getManusApiKey(authHeader);
    if (!manusApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Manus API key not configured', 
          error_code: 'MANUS_NOT_CONFIGURED',
          key_source: null,
          manus_ok: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize the key
    const normalizedKey = manusApiKey.trim();
    
    // Compute a safe fingerprint (first 8 chars of hex-encoded hash)
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Determine key source
    const envKey = Deno.env.get('MANUS_API_KEY');
    const keySource = envKey ? 'env' : 'user';

    // Get credential metadata from database
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: credentialRow } = await supabase
      .from('user_credentials')
      .select('updated_at')
      .eq('user_id', user.id)
      .eq('service_type', 'manus')
      .eq('credential_key', 'api_key')
      .maybeSingle();

    // Test the key against Manus API (lightweight endpoint)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let manusResponse: Response;
    try {
      // Use a lightweight endpoint to validate the key
      manusResponse = await fetch('https://api.manus.ai/v1/projects', {
        method: 'GET',
        headers: {
          'API_KEY': normalizedKey,
        },
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Manus API request timed out', 
            error_code: 'MANUS_TIMEOUT',
            manus_ok: false,
            key_source: keySource,
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

    if (!manusResponse.ok) {
      const errorText = await manusResponse.text();
      console.log('[manus-key-validate] Manus API returned error:', manusResponse.status, errorText);
      
      const errorCode = manusResponse.status === 401 ? 'MANUS_INVALID_KEY' : 'MANUS_API_ERROR';
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: manusResponse.status === 401 
            ? 'Invalid API key - Manus rejected the configured key' 
            : `Manus API error: ${errorText}`,
          error_code: errorCode,
          manus_ok: false,
          manus_status: manusResponse.status,
          key_source: keySource,
          key_length: normalizedKey.length,
          fingerprint: fingerprint,
          updated_at: credentialRow?.updated_at || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse successful response to get project count
    let projectCount = 0;
    try {
      const manusData = await manusResponse.json();
      projectCount = Array.isArray(manusData) ? manusData.length : (manusData.projects?.length || 0);
    } catch {
      // Ignore parse errors, just set count to 0
    }

    console.log('[manus-key-validate] Manus key validated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        manus_ok: true,
        message: 'Manus API key is valid',
        key_source: keySource,
        key_length: normalizedKey.length,
        fingerprint: fingerprint,
        project_count: projectCount,
        updated_at: credentialRow?.updated_at || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    console.error('[manus-key-validate] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'INTERNAL_ERROR',
        manus_ok: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
