import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { fetchModelConfig, resolveApiModelId, fetchActiveModels, getDefaultModelFromSettings } from "../_shared/models.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

// Resolve model using DB
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
    return true;
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

// Create OpenAI conversation
async function createOpenAIConversation(apiKey: string, metadata?: Record<string, string>): Promise<string> {
  console.log('Creating new OpenAI conversation...');
  
  const response = await fetch('https://api.openai.com/v1/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata: metadata || {},
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create OpenAI conversation:', error);
    throw new Error(error.error?.message || 'Failed to create conversation');
  }

  const data = await response.json();
  console.log('Created OpenAI conversation:', data.id);
  return data.id;
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
      .maybeSingle();

    if (assistantError || !assistant) {
      console.error('Error fetching assistant:', assistantError);
      return new Response(
        JSON.stringify({ error: 'Assistant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistantData = assistant as any;

    // Determine which thread/conversation to use
    let lastResponseId: string | null = null;
    let activeThreadRowId: string | null = thread_row_id || null;

    // Try to get existing thread's last_response_id (for chaining) and verify ownership
    if (activeThreadRowId) {
      const { data: existingThread } = await supabase
        .from(TABLES.THREADS)
        .select('openai_conversation_id, last_response_id, owner_id')
        .eq('row_id', activeThreadRowId)
        .maybeSingle();
      
      // Enforce ownership - only owner can use this thread
      if (existingThread && existingThread.owner_id !== validation.user?.id) {
        console.warn('Unauthorized thread access attempt:', { thread_row_id: activeThreadRowId, owner: existingThread.owner_id, requester: validation.user?.id });
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (existingThread?.last_response_id?.startsWith('resp_')) {
        lastResponseId = existingThread.last_response_id;
        console.log('Using last_response_id for chaining:', lastResponseId);
      }
    }

    // Create new thread if no valid existing thread
    if (!activeThreadRowId) {
      const conversationId = await createOpenAIConversation(openAIApiKey, {
        assistant_row_id: assistant_row_id,
        type: 'studio_chat',
      });

      // Create thread record
      const { data: newThread, error: newThreadError } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id: assistant_row_id,
          child_prompt_row_id: null,
          openai_conversation_id: conversationId,
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
          owner_id: validation.user?.id,
        })
        .select()
        .maybeSingle();

      if (newThreadError || !newThread) {
        console.error('Failed to create thread:', newThreadError);
        return new Response(
          JSON.stringify({ error: 'Failed to create conversation thread' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      activeThreadRowId = newThread.row_id;
      console.log('Created new thread:', activeThreadRowId);
    }

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

    // Model configuration - use DB for defaults and resolution
    const defaultModel = await getDefaultModelFromSettings(supabase);
    const requestedModel = assistantData.model_override || defaultModel;
    const modelId = await resolveModel(supabase, requestedModel);
    const modelSupportsTemp = await supportsTemperature(supabase, requestedModel);

    // Build system instructions with additional context
    let systemContent = assistantData.instructions || 'You are a helpful assistant.';
    if (additionalInstructions) {
      systemContent += additionalInstructions;
    }
    if (confluenceContext) {
      systemContent += confluenceContext;
    }

    // Build request body for Responses API
    const requestBody: any = {
      model: modelId,
      input: user_message,
    };

    // Use previous_response_id for multi-turn chaining (GPT-5 safe)
    if (lastResponseId?.startsWith('resp_')) {
      requestBody.previous_response_id = lastResponseId;
      console.log('Continuing from previous response:', lastResponseId);
    } else {
      console.log('No previous_response_id - starting fresh conversation turn');
    }

    // Add instructions if present
    if (systemContent && systemContent.trim()) {
      requestBody.instructions = systemContent.trim();
    }

    // Add model parameters
    const temperature = assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined;
    const topP = assistantData.top_p_override ? parseFloat(assistantData.top_p_override) : undefined;
    const maxTokens = assistantData.max_tokens_override ? parseInt(assistantData.max_tokens_override, 10) : undefined;

    if (modelSupportsTemp && temperature !== undefined && !isNaN(temperature)) {
      requestBody.temperature = temperature;
    }
    if (modelSupportsTemp && topP !== undefined && !isNaN(topP)) {
      requestBody.top_p = topP;
    }
    if (maxTokens !== undefined && !isNaN(maxTokens)) {
      requestBody.max_output_tokens = maxTokens;
    }

    console.log('Calling Responses API for Studio chat:', { 
      model: modelId, 
      previous_response_id: lastResponseId,
      hasInstructions: !!requestBody.instructions,
    });

    // Call Responses API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Responses API error:', error);
      
      const errorMessage = error.error?.message || 'Responses API call failed';
      const isRateLimit = response.status === 429;
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: isRateLimit ? 429 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = await response.json();
    console.log('Responses API response received:', responseData.id);

    // Extract response content from Responses API format
    let responseText = '';
    if (responseData.output && Array.isArray(responseData.output)) {
      for (const item of responseData.output) {
        if (item.type === 'message' && item.content && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' && part.text) {
              responseText += part.text;
            }
          }
        }
      }
    }

    // Update thread record
    if (activeThreadRowId) {
      await supabase
        .from(TABLES.THREADS)
        .update({ 
          last_message_at: new Date().toISOString(),
          last_response_id: responseData.id,
        })
        .eq('row_id', activeThreadRowId);
    }

    // Extract usage
    const usage = {
      prompt_tokens: responseData.usage?.input_tokens || 0,
      completion_tokens: responseData.usage?.output_tokens || 0,
      total_tokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0),
    };

    console.log('Studio chat completed');

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        thread_row_id: activeThreadRowId,
        context_included: contextIncluded,
        usage,
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
