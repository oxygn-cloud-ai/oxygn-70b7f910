import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

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

  if (!isAllowedDomain(user.email)) {
    return { valid: false, error: 'Access denied. Only chocfin.com and oxygn.cloud accounts are allowed.' };
  }

  return { valid: true, user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    console.log('[credentials-manager] Request from:', validation.user?.email);

    const { action, ...params } = await req.json();
    console.log('[credentials-manager] Action:', action);

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

        // Query for all credential keys for this service
        const { data: credentials, error } = await supabase
          .from('user_credentials')
          .select('credential_key')
          .eq('user_id', userId)
          .eq('service_type', service);

        if (error) {
          console.error('[credentials-manager] Error fetching status:', error);
          throw error;
        }

        // Return which keys are configured (never return values)
        const configuredKeys = credentials?.map(c => c.credential_key) || [];
        const status: Record<string, boolean> = {};
        
        // For confluence, check for email and api_token
        if (service === 'confluence') {
          status.email = configuredKeys.includes('email');
          status.api_token = configuredKeys.includes('api_token');
        } else {
          // Generic: just indicate which keys exist
          configuredKeys.forEach(key => {
            status[key] = true;
          });
        }

        console.log('[credentials-manager] Status for', service, ':', status);

        return new Response(
          JSON.stringify({ success: true, status }),
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

        // Use the encrypt_credential RPC function
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

        console.log('[credentials-manager] Saved encrypted credential:', service, key);

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

        console.log('[credentials-manager] Deleted credential(s):', service, key || '(all)');

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

        // Get unique service types
        const services = [...new Set(data?.map(c => c.service_type) || [])];
        
        console.log('[credentials-manager] Configured services:', services);

        return new Response(
          JSON.stringify({ success: true, services }),
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
