import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateCredentialsManagerInput } from "../_shared/validation.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; user?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  return { valid: true, user };
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  try {
    // Validate user authentication
    const validation = await validateUser(req);
    if (!validation.valid) {
      console.error('[credentials-manager] Auth validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = validation.user?.id;

    let requestBody: any;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, ...params } = requestBody;
    
    // Validate input
    const validation_result = validateCredentialsManagerInput({ action, ...params });
    if (!validation_result.valid) {
      return new Response(
        JSON.stringify({ error: validation_result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const encryptionKey = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper: check if user is admin
    const checkIsAdmin = async (): Promise<boolean> => {
      const { data } = await supabase.rpc('is_admin', { _user_id: userId });
      return data === true;
    };

    switch (action) {
      // Get credential status for a service (returns boolean flags, never actual values)
      case 'get_status': {
        const { service } = params;
        
        if (!service) {
          return new Response(
            JSON.stringify({ error: 'Service type required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Query user credentials
        const { data: credentials, error } = await supabase
          .from('user_credentials')
          .select('credential_key')
          .eq('user_id', userId)
          .eq('service_type', service);

        if (error) {
          console.error('[credentials-manager] Error fetching status:', error);
          throw error;
        }

        // Query system credentials for this service
        const { data: systemCreds } = await supabase
          .from('system_credentials')
          .select('credential_key')
          .eq('service_type', service);

        const systemKeys = systemCreds?.map(c => c.credential_key) || [];
        const systemConfigured = systemKeys.length > 0;

        // Return which keys are configured (never return values)
        const configuredKeys = credentials?.map(c => c.credential_key) || [];
        const status: Record<string, boolean> = {};
        
        // For confluence, check for email and api_token
        if (service === 'confluence') {
          status.email = configuredKeys.includes('email');
          status.api_token = configuredKeys.includes('api_token');
        } else if (service === 'manus') {
          status.api_key = configuredKeys.includes('api_key');
        } else if (service === 'gemini' || service === 'google') {
          status.api_key = configuredKeys.includes('api_key');
        } else if (service === 'openai') {
          status.api_key = configuredKeys.includes('api_key');
        } else if (service === 'anthropic') {
          status.api_key = configuredKeys.includes('api_key');
        } else if (service === 'figma') {
          status.access_token = configuredKeys.includes('access_token');
        } else {
          configuredKeys.forEach(key => {
            status[key] = true;
          });
        }

        return new Response(
          JSON.stringify({ success: true, status, systemConfigured }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set a credential (encrypts and stores)
      case 'set': {
        const { service, key, value } = params;

        if (!service || !key || !value) {
          return new Response(
            JSON.stringify({ error: 'Service, key, and value are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase.rpc('encrypt_credential', {
          p_user_id: userId,
          p_service: service,
          p_key: key,
          p_value: value,
          p_encryption_key: encryptionKey
        });

        if (error) {
          console.error('[credentials-manager] Error encrypting credential:', error);
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete a credential
      case 'delete': {
        const { service, key } = params;

        if (!service) {
          return new Response(
            JSON.stringify({ error: 'Service type required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase
          .from('user_credentials')
          .delete()
          .eq('user_id', userId)
          .eq('service_type', service);

        if (key) {
          query = query.eq('credential_key', key);
        }

        const { error } = await query;

        if (error) {
          console.error('[credentials-manager] Error deleting credential:', error);
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List all configured services for the user
      case 'list_services': {
        const { data, error } = await supabase
          .from('user_credentials')
          .select('service_type')
          .eq('user_id', userId);

        if (error) {
          console.error('[credentials-manager] Error listing services:', error);
          throw error;
        }

        const services = [...new Set(data?.map(c => c.service_type) || [])];

        return new Response(
          JSON.stringify({ success: true, services }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get decrypted credential value (for internal service-to-service calls)
      // Now uses decrypt_credential_with_fallback to check system credentials first
      case 'get_decrypted': {
        const { service, key } = params;

        if (!service || !key) {
          return new Response(
            JSON.stringify({ error: 'Service and key are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use fallback function: system_credentials first, then user_credentials
        const { data: decrypted, error: decryptError } = await supabase.rpc('decrypt_credential_with_fallback', {
          p_user_id: userId,
          p_service: service,
          p_key: key,
          p_encryption_key: encryptionKey
        });

        if (decryptError) {
          console.error('[credentials-manager] Decrypt error:', decryptError);
          return new Response(
            JSON.stringify({ success: false, error: 'Decryption failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!decrypted) {
          return new Response(
            JSON.stringify({ success: false, error: 'Credential not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, value: decrypted }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ====== System credential actions (admin-only) ======

      // Set a system-wide credential (admin only)
      case 'set_system': {
        const { service, key, value } = params;

        if (!service || !key || !value) {
          return new Response(
            JSON.stringify({ error: 'Service, key, and value are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase.rpc('encrypt_system_credential', {
          p_service: service,
          p_key: key,
          p_value: value,
          p_encryption_key: encryptionKey
        });

        if (error) {
          console.error('[credentials-manager] Error encrypting system credential:', error);
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete a system-wide credential (admin only)
      case 'delete_system': {
        const { service, key } = params;

        if (!service) {
          return new Response(
            JSON.stringify({ error: 'Service type required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase
          .from('system_credentials')
          .delete()
          .eq('service_type', service);

        if (key) {
          query = query.eq('credential_key', key);
        }

        const { error } = await query;

        if (error) {
          console.error('[credentials-manager] Error deleting system credential:', error);
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get system credential status (any authenticated user can check)
      case 'get_system_status': {
        const { service } = params;

        if (!service) {
          return new Response(
            JSON.stringify({ error: 'Service type required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: systemCreds, error } = await supabase
          .from('system_credentials')
          .select('credential_key')
          .eq('service_type', service);

        if (error) {
          console.error('[credentials-manager] Error fetching system status:', error);
          throw error;
        }

        const systemKeys = systemCreds?.map(c => c.credential_key) || [];
        const status: Record<string, boolean> = {};

        if (service === 'confluence') {
          status.email = systemKeys.includes('email');
          status.api_token = systemKeys.includes('api_token');
        } else if (service === 'figma') {
          status.access_token = systemKeys.includes('access_token');
        } else {
          // Default: check for api_key
          status.api_key = systemKeys.includes('api_key');
        }

        return new Response(
          JSON.stringify({ success: true, status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    console.error('[credentials-manager] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
