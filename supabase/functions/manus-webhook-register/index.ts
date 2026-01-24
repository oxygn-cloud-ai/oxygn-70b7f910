import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getManusApiKey } from "../_shared/credentials.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Manus API key
    const manusApiKey = await getManusApiKey(authHeader);
    if (!manusApiKey) {
      return new Response(
        JSON.stringify({ error: 'Manus API key not configured. Add it in Settings > Integrations.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract project ref from SUPABASE_URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/manus-webhook`;

    console.log('[manus-webhook-register] Registering webhook URL:', webhookUrl);

    // Register webhook with Manus
    const response = await fetch('https://api.manus.ai/v1/webhooks', {
      method: 'POST',
      headers: {
        'API_KEY': manusApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhook: { url: webhookUrl } }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[manus-webhook-register] Registration failed:', error);
      return new Response(
        JSON.stringify({ error: `Registration failed: ${error}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const webhookId = data.webhook_id || data.id;
    
    console.log('[manus-webhook-register] Successfully registered, webhook_id:', webhookId);
    
    // Store webhook ID in settings for reference
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabase
      .from('q_settings')
      .upsert({
        setting_key: 'manus_webhook_id',
        setting_value: webhookId,
        setting_description: 'Registered Manus webhook ID',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' });

    return new Response(
      JSON.stringify({ 
        success: true, 
        webhook_id: webhookId,
        webhook_url: webhookUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    console.error('[manus-webhook-register] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
