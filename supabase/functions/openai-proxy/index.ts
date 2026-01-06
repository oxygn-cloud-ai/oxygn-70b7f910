import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchModelConfig, resolveApiModelId, fetchActiveModels, getDefaultModelFromSettings } from "../_shared/models.ts";
import { validateOpenAIProxyInput } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

// Resolve model using DB, with fallback to modelId itself
async function resolveModel(supabase: any, modelId: string): Promise<string> {
  try {
    return await resolveApiModelId(supabase, modelId);
  } catch {
    return modelId;
  }
}

// Check if model supports temperature from DB
async function supportsTemperature(supabase: any, modelId: string): Promise<boolean> {
  try {
    const config = await fetchModelConfig(supabase, modelId);
    return config?.supportsTemperature ?? true;
  } catch {
    return true; // Default to supporting temperature
  }
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

    const requestBody = await req.json();
    const { action, ...body } = requestBody;
    console.log('OpenAI proxy request:', { action, hasBody: !!body, user: validation.user?.email });

    // Validate input
    const inputValidation = validateOpenAIProxyInput(requestBody);
    if (!inputValidation.valid) {
      console.warn('Input validation failed:', inputValidation.error);
      return new Response(
        JSON.stringify({ error: inputValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase client for DB lookups
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Health check / connection test
    if (action === 'health') {
      console.log('Running health check...');
      const start = Date.now();
      
      // Use default model from DB for health check
      const healthCheckModelId = await getDefaultModelFromSettings(supabase);
      // Resolve to actual API model ID (same as chat action does)
      const healthCheckModel = await resolveModel(supabase, healthCheckModelId);

      // Fetch model config to get correct token param
      const modelConfig = await fetchModelConfig(supabase, healthCheckModelId);
      const tokenParam = modelConfig?.tokenParam || 'max_tokens';

      console.log('Health check using model:', healthCheckModelId, '-> resolved:', healthCheckModel, 'tokenParam:', tokenParam);

      const requestBody: Record<string, unknown> = {
        model: healthCheckModel,
        messages: [{ role: 'user', content: 'Hi' }],
      };

      // Use the correct token parameter for this model
      // Use 50 tokens minimum - GPT-5 rejects token limits that are too restrictive
      requestBody[tokenParam] = 50;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const latency = Date.now() - start;
      console.log('Health check response:', response.status, 'latency:', latency);

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        return new Response(
          JSON.stringify({ status: 'success', message: `Connected (${latency}ms)`, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('Health check failed:', responseData);

      // Handle max_tokens limit error as a success - it means we connected and got a response
      if (responseData.error?.message?.includes('max_tokens') || 
          responseData.error?.message?.includes('model output limit')) {
        console.log('Health check hit token limit but connection is valid');
        return new Response(
          JSON.stringify({ status: 'success', message: `Connected (${latency}ms)`, latency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 401) {
        return new Response(
          JSON.stringify({ status: 'error', message: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 429) {
        const message = responseData.error?.code === 'insufficient_quota' 
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
        JSON.stringify({ status: 'error', message: responseData.error?.message || 'Unknown error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List models - return active models from DB instead of filtering OpenAI API
    if (action === 'models') {
      console.log('Fetching active models from database...');
      const dbModels = await fetchActiveModels(supabase);
      const modelIds = dbModels.map(m => m.modelId).sort();
      
      console.log('Found models:', modelIds.length);
      return new Response(
        JSON.stringify({ status: 'success', message: `${modelIds.length} models available`, available: modelIds }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chat completions (main API call)
    if (action === 'chat') {
      console.log('Processing chat request...');
      const { model, messages, web_search_enabled, ...settings } = body;
      const startTime = Date.now();

      // Use DB for model resolution and defaults
      const defaultModel = await getDefaultModelFromSettings(supabase);
      const requestedModel = model || defaultModel;
      const modelId = await resolveModel(supabase, requestedModel);
      
      // Get model config for capabilities
      const modelConfig = await fetchModelConfig(supabase, requestedModel);
      const tokenParam = modelConfig?.tokenParam || 'max_tokens';
      const modelSupportsTemp = modelConfig?.supportsTemperature ?? true;
      
      console.log('Model resolution:', { 
        requested: requestedModel, 
        resolved: modelId, 
        tokenParam,
        supportsTemperature: modelSupportsTemp 
      });

      const requestBody: Record<string, unknown> = {
        model: modelId,
        messages,
      };

      // Add optional parameters based on model capabilities
      if (modelSupportsTemp && settings.temperature !== undefined) {
        requestBody.temperature = settings.temperature;
      }
      
      // Use correct token parameter for this model
      if (settings.max_tokens !== undefined) {
        requestBody[tokenParam] = settings.max_tokens;
      }
      
      if (modelSupportsTemp && settings.top_p !== undefined) {
        requestBody.top_p = settings.top_p;
      }
      if (settings.frequency_penalty !== undefined) requestBody.frequency_penalty = settings.frequency_penalty;
      if (settings.presence_penalty !== undefined) requestBody.presence_penalty = settings.presence_penalty;

      console.log('OpenAI Chat request:', { 
        model: requestBody.model, 
        messageCount: messages?.length, 
        supportsTemperature: modelSupportsTemp
      });

      // Add timeout for chat completions (30 seconds for quick test calls)
      const chatController = new AbortController();
      const chatTimeoutId = setTimeout(() => chatController.abort(), 30000);
      
      let response: Response;
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: chatController.signal,
        });
      } catch (fetchError: unknown) {
        clearTimeout(chatTimeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Chat completions request timed out after 30 seconds');
          return new Response(
            JSON.stringify({ error: 'Request timed out after 30 seconds' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw fetchError;
      }
      clearTimeout(chatTimeoutId);

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
