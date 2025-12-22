import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TABLES } from "../_shared/tables.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

// Map friendly model IDs to actual OpenAI model names
const MODEL_MAPPING: Record<string, string> = {
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4-turbo': 'gpt-4-turbo',
  'o1': 'o1',
  'o1-mini': 'o1-mini',
  'o1-preview': 'o1-preview',
  // Legacy mappings
  'gpt-5': 'gpt-4o',
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

    const { assistant_row_id, user_message, thread_row_id, include_child_context = true } = await req.json();

    if (!assistant_row_id || !user_message) {
      return new Response(
        JSON.stringify({ error: 'assistant_row_id and user_message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Studio chat request:', { assistant_row_id, user: validation.user?.email });

    // Fetch assistant details
    const { data: assistant, error: assistantError } = await supabase
      .from(TABLES.ASSISTANTS)
      .select('*')
      .eq('row_id', assistant_row_id)
      .single();

    if (assistantError || !assistant) {
      console.error('Error fetching assistant:', assistantError);
      return new Response(
        JSON.stringify({ error: 'Assistant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistantData = assistant as any;

    // Build child prompt context if enabled
    let additionalInstructions = '';
    const contextIncluded: string[] = [];

    if (include_child_context && assistantData.prompt_row_id) {
      const { data: childPrompts, error: childError } = await supabase
        .from(TABLES.PROMPTS)
        .select('prompt_name, input_admin_prompt, input_user_prompt, note')
        .eq('parent_row_id', assistantData.prompt_row_id)
        .eq('is_deleted', false)
        .order('position', { ascending: true });

      if (!childError && childPrompts && childPrompts.length > 0) {
        const contextParts: string[] = [];
        
        for (const child of childPrompts) {
          const parts: string[] = [];
          if (child.input_admin_prompt) parts.push(`System: ${child.input_admin_prompt}`);
          if (child.input_user_prompt) parts.push(`User Template: ${child.input_user_prompt}`);
          if (child.note) parts.push(`Notes: ${child.note}`);
          
          if (parts.length > 0) {
            contextParts.push(`=== ${child.prompt_name} ===\n${parts.join('\n')}`);
            contextIncluded.push(child.prompt_name);
          }
        }

        if (contextParts.length > 0) {
          additionalInstructions = `\n\nContext from related prompts:\n${contextParts.join('\n\n')}`;
        }
      }
    }

    console.log('Context included from child prompts:', contextIncluded);

    // Fetch attached Confluence pages for context
    const { data: confluencePages } = await supabase
      .from(TABLES.CONFLUENCE_PAGES)
      .select('page_id, page_title, content_text, page_url')
      .eq('assistant_row_id', assistant_row_id);

    // Build Confluence context
    let confluenceContext = '';
    if (confluencePages && confluencePages.length > 0) {
      const textPages = confluencePages.filter((p: any) => p.content_text);
      if (textPages.length > 0) {
        confluenceContext = textPages
          .map((p: any) => `## ${p.page_title}\n${p.content_text}`)
          .join('\n\n---\n\n');
        confluenceContext = `\n\n[Attached Confluence Pages]\n${confluenceContext}`;
      }
    }

    // Model configuration
    const requestedModel = assistantData.model_override || 'gpt-4o-mini';
    const modelId = resolveModelId(requestedModel);
    const isNoTempModel = NO_TEMPERATURE_MODELS.some(m => modelId.toLowerCase().includes(m));

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];

    // System instructions with additional context
    let systemContent = assistantData.instructions || 'You are a helpful assistant.';
    if (additionalInstructions) {
      systemContent += additionalInstructions;
    }
    if (confluenceContext) {
      systemContent += confluenceContext;
    }
    
    messages.push({ role: 'system', content: systemContent });
    messages.push({ role: 'user', content: user_message });

    const requestBody: any = {
      model: modelId,
      messages,
    };

    // Add model parameters
    const temperature = assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined;
    const topP = assistantData.top_p_override ? parseFloat(assistantData.top_p_override) : undefined;
    const maxTokens = assistantData.max_tokens_override ? parseInt(assistantData.max_tokens_override, 10) : undefined;

    if (!isNoTempModel && temperature !== undefined && !isNaN(temperature)) {
      requestBody.temperature = temperature;
    }
    if (!isNoTempModel && topP !== undefined && !isNaN(topP)) {
      requestBody.top_p = topP;
    }
    if (maxTokens !== undefined && !isNaN(maxTokens)) {
      requestBody.max_tokens = maxTokens;
    }

    console.log('Calling Chat Completions API for Studio chat:', { model: modelId, messageCount: messages.length });

    // Call Chat Completions API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Chat Completions API error:', error);
      
      const errorMessage = error.error?.message || 'Chat Completions API call failed';
      const isRateLimit = response.status === 429;
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: isRateLimit ? 429 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();
    console.log('Chat Completions API response received');

    // Extract response content
    const responseText = responseData.choices?.[0]?.message?.content || '';

    // Create or update thread record
    let threadRowId: string | null = thread_row_id || null;
    
    if (threadRowId) {
      await supabase
        .from(TABLES.THREADS)
        .update({ last_message_at: new Date().toISOString() })
        .eq('row_id', threadRowId);
    } else {
      const { data: newThread } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id: assistant_row_id,
          child_prompt_row_id: null,
          openai_thread_id: `chat_${Date.now()}`, // Use timestamp-based ID for chat threads
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
        })
        .select()
        .single();

      threadRowId = newThread?.row_id || null;
    }

    console.log('Studio chat completed');

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        thread_row_id: threadRowId,
        context_included: contextIncluded,
        usage: responseData.usage,
        model: modelId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in studio-chat:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
