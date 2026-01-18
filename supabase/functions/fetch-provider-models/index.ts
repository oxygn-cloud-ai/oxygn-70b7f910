import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getDecryptedCredential } from "../_shared/credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModelData {
  model_id: string;
  model_name: string;
  provider: string;
  api_model_id: string;
  context_window: number | null;
  max_output_tokens: number | null;
  supports_temperature: boolean;
  supports_reasoning_effort: boolean;
  token_param: string;
  supported_settings: string[];
  supported_tools: string[];
  input_cost_per_million: number | null;
  output_cost_per_million: number | null;
  api_base_url: string | null;
  auth_header_name: string;
  auth_header_format: string;
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

  return { valid: true, user };
}

async function fetchOpenAIModels(): Promise<ModelData[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data?.data || !Array.isArray(data.data)) {
      throw new Error('Invalid OpenAI API response structure');
    }

    // Filter to chat-compatible models only
    const chatModels = data.data.filter((m: any) => {
      const id = m.id?.toLowerCase() || '';
      // Include GPT-4, GPT-5, o1, o3, o4 models
      const isChat = /^(gpt-4|gpt-5|o1|o3|o4)/.test(id);
      // Exclude audio, realtime, embedding models
      const isExcluded = id.includes('audio') || 
                         id.includes('realtime') || 
                         id.includes('embedding') ||
                         id.includes('whisper') ||
                         id.includes('tts') ||
                         id.includes('dall-e') ||
                         id.includes('davinci') ||
                         id.includes('babbage');
      return isChat && !isExcluded;
    });

    return chatModels.map((m: any) => {
      const id = m.id;
      // Determine if it's a reasoning model (o1, o3, o4)
      const isReasoningModel = /^o[134]/.test(id);
      
      return {
        model_id: id,
        model_name: id,
        provider: 'openai',
        api_model_id: id,
        // OpenAI API doesn't provide these - admin must fill in
        context_window: null,
        max_output_tokens: null,
        supports_temperature: !isReasoningModel, // Reasoning models don't support temperature
        supports_reasoning_effort: isReasoningModel,
        token_param: isReasoningModel ? 'max_completion_tokens' : 'max_tokens',
        supported_settings: isReasoningModel 
          ? ['seed', 'tool_choice', 'reasoning_effort', 'response_format', 'max_output_tokens']
          : ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty'],
        supported_tools: ['web_search', 'code_interpreter', 'file_search'],
        input_cost_per_million: null,
        output_cost_per_million: null,
        api_base_url: 'https://api.openai.com/v1',
        auth_header_name: 'Authorization',
        auth_header_format: 'Bearer {key}',
      };
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out');
    }
    throw error;
  }
}

async function fetchGeminiModels(authHeader: string): Promise<ModelData[]> {
  // Get user's Gemini API key from encrypted credentials
  const apiKey = await getDecryptedCredential(authHeader, 'gemini', 'api_key');
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Add your API key in Settings → Integrations.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Gemini uses query param for auth, not Bearer token
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data?.models || !Array.isArray(data.models)) {
      throw new Error('Invalid Gemini API response structure');
    }

    // Filter to content generation models only
    const genModels = data.models.filter((m: any) => 
      m.supportedGenerationMethods?.includes('generateContent')
    );

    return genModels.map((m: any) => {
      const modelId = m.name?.replace('models/', '') || '';
      
      return {
        model_id: modelId,
        model_name: m.displayName || modelId,
        provider: 'google',
        api_model_id: modelId,
        // Gemini API provides these directly!
        context_window: m.inputTokenLimit || null,
        max_output_tokens: m.outputTokenLimit || null,
        supports_temperature: true,
        supports_reasoning_effort: false,
        token_param: 'max_tokens',
        supported_settings: ['temperature', 'max_tokens', 'top_p', 'response_format'],
        supported_tools: m.supportedGenerationMethods?.includes('generateContent') 
          ? ['code_interpreter'] : [],
        // Pricing not in API - admin must fill in
        input_cost_per_million: null,
        output_cost_per_million: null,
        api_base_url: 'https://generativelanguage.googleapis.com/v1beta',
        auth_header_name: 'x-goog-api-key',
        auth_header_format: '{key}',
      };
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw new Error('Gemini API request timed out');
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = await validateUser(req);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { provider } = await req.json();
    
    if (!provider || !['openai', 'google'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider. Supported: openai, google' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let models: ModelData[] = [];
    const authHeader = req.headers.get('Authorization') || '';

    if (provider === 'openai') {
      models = await fetchOpenAIModels();
    } else if (provider === 'google') {
      models = await fetchGeminiModels(authHeader);
    }

    console.log(`[fetch-provider-models] Fetched ${models.length} ${provider} models`);

    return new Response(
      JSON.stringify({ success: true, models, provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[fetch-provider-models] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
