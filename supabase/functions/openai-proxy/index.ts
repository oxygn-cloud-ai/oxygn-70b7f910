import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

// Map friendly model IDs to actual OpenAI model names
const MODEL_MAPPING: Record<string, string> = {
  // GPT-4o family (current production models)
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4-turbo',
  // Reasoning models
  'o1': 'o1',
  'o1-mini': 'o1-mini',
  'o1-preview': 'o1-preview',
  // Legacy mappings for backwards compatibility
  'gpt-5': 'gpt-4o', // Map to gpt-4o as gpt-5 doesn't exist
  'gpt-5-mini': 'gpt-4o-mini',
  'gpt-5-nano': 'gpt-4o-mini',
  'gpt-4.1': 'gpt-4o',
  'gpt-4.1-mini': 'gpt-4o-mini',
};

// Models that don't support temperature parameter
const NO_TEMPERATURE_MODELS = ['o1', 'o1-mini', 'o1-preview'];

function resolveModelId(modelId: string): string {
  return MODEL_MAPPING[modelId] || modelId;
}

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user and domain
    const validation = await validateUser(req);
    if (!validation.valid) {
      console.error('Auth validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User validated:', validation.user?.email);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...body } = await req.json();
    console.log('OpenAI proxy request:', { action, hasBody: !!body, user: validation.user?.email });

    // Health check / connection test
    if (action === 'health') {
      console.log('Running health check...');
      const start = Date.now();
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
      });

      const latency = Date.now() - start;
      console.log('Health check response:', response.status, 'latency:', latency);

      if (response.ok) {
        return new Response(
          JSON.stringify({ status: 'success', message: `Connected (${latency}ms)`, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const errorData = await response.json().catch(() => ({}));
      console.error('Health check failed:', errorData);

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 429) {
        const message = errorData.error?.code === 'insufficient_quota' 
          ? 'Quota exceeded - check billing' 
          : 'Rate limited - try again later';
        return new Response(
          JSON.stringify({ status: 'warning', message, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status >= 500) {
        return new Response(
          JSON.stringify({ status: 'warning', message: `OpenAI server error (${response.status})`, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ status: 'error', message: errorData.error?.message || 'Unknown error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List models
    if (action === 'models') {
      console.log('Fetching models...');
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch models:', response.status);
        return new Response(
          JSON.stringify({ status: 'error', message: 'Could not fetch models', available: [] }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const chatModels = data.data
        .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1'))
        .map((m: any) => m.id)
        .sort();

      console.log('Found models:', chatModels.length);
      return new Response(
        JSON.stringify({ status: 'success', message: `${chatModels.length} GPT models available`, available: chatModels }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chat completions (main API call)
    if (action === 'chat') {
      console.log('Processing chat request...');
      const { model, messages, web_search_enabled, ...settings } = body;
      const startTime = Date.now();

      const requestedModel = model || 'gpt-4o-mini';
      const modelId = resolveModelId(requestedModel);
      
      console.log('Model resolution:', { requested: requestedModel, resolved: modelId });
      
      // Check if model supports temperature
      const isNoTempModel = NO_TEMPERATURE_MODELS.some(m => modelId.toLowerCase().includes(m));

      const requestBody: any = {
        model: modelId,
        messages,
      };

      // Add optional parameters based on model capabilities
      if (!isNoTempModel && settings.temperature !== undefined) {
        requestBody.temperature = settings.temperature;
      }
      
      if (settings.max_tokens !== undefined) {
        requestBody.max_tokens = settings.max_tokens;
      }
      
      if (!isNoTempModel && settings.top_p !== undefined) {
        requestBody.top_p = settings.top_p;
      }
      if (settings.frequency_penalty !== undefined) requestBody.frequency_penalty = settings.frequency_penalty;
      if (settings.presence_penalty !== undefined) requestBody.presence_penalty = settings.presence_penalty;

      console.log('OpenAI Chat request:', { 
        model: requestBody.model, 
        messageCount: messages?.length, 
        isNoTempModel
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const latencyMs = Date.now() - startTime;
      const responseData = await response.json();

      if (!response.ok) {
        console.error('OpenAI API error:', responseData);
        return new Response(
          JSON.stringify({ error: responseData.error?.message || 'OpenAI API error' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('OpenAI response received, tokens:', responseData.usage);

      // Add enhanced metadata for cost tracking
      const enhancedResponse = {
        ...responseData,
        _metadata: {
          latency_ms: latencyMs,
          requested_model: requestedModel,
          resolved_model: modelId,
          web_search_enabled: false,
          timestamp: new Date().toISOString(),
        }
      };

      return new Response(
        JSON.stringify(enhancedResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: health, models, or chat' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
