import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { fetchModelConfig, resolveApiModelId, fetchActiveModels, getDefaultModelFromSettings } from "../_shared/models.ts";
import { validateStudioChatInput } from "../_shared/validation.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getOpenAIApiKey, getAnthropicApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES, buildErrorResponse, getHttpStatus } from "../_shared/errorCodes.ts";
import { buildAnthropicRequest, callAnthropicAPI, parseAnthropicResponse, type AnthropicMessage } from "../_shared/anthropic.ts";

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
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
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

    const requestBody = await req.json();
    
    // Validate input
    const inputValidation = validateStudioChatInput(requestBody);
    if (!inputValidation.valid) {
      console.warn('Input validation failed:', inputValidation.error);
      return new Response(
        JSON.stringify({ error: inputValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { assistant_row_id, user_message, thread_row_id, include_child_context = true } = requestBody;

    const authHeader = req.headers.get('Authorization')!;
    const openAIApiKey = await getOpenAIApiKey(authHeader);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.OPENAI_NOT_CONFIGURED)),
        { status: getHttpStatus(ERROR_CODES.OPENAI_NOT_CONFIGURED), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const modelConfig = await fetchModelConfig(supabase, requestedModel);

    // Build system instructions with additional context
    let systemContent = assistantData.instructions || 'You are a helpful assistant.';
    if (additionalInstructions) {
      systemContent += additionalInstructions;
    }
    if (confluenceContext) {
      systemContent += confluenceContext;
    }

    // Model parameters
    const temperature = assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined;
    const topP = assistantData.top_p_override ? parseFloat(assistantData.top_p_override) : undefined;
    const maxTokens = assistantData.max_tokens_override ? parseInt(assistantData.max_tokens_override, 10) : undefined;

    let responseText = '';
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let newResponseId: string | null = null;

    // ========================================================================
    // PROVIDER ROUTING
    // ========================================================================
    const provider = modelConfig?.provider || 'openai';
    
    if (provider === 'anthropic') {
      // --- ANTHROPIC PROVIDER ---
      console.log('Using Anthropic provider for model:', modelId);
      
      const anthropicApiKey = await getAnthropicApiKey(authHeader);
      if (!anthropicApiKey) {
        return new Response(
          JSON.stringify(buildErrorResponse(ERROR_CODES.ANTHROPIC_NOT_CONFIGURED)),
          { status: getHttpStatus(ERROR_CODES.ANTHROPIC_NOT_CONFIGURED), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reconstruct message history from thread (Anthropic is stateless)
      const messages: AnthropicMessage[] = [];
      
      if (activeThreadRowId) {
        const { data: threadMessages } = await supabase
          .from('q_prompt_family_messages')
          .select('role, content')
          .eq('thread_row_id', activeThreadRowId)
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (threadMessages) {
          for (const msg of threadMessages) {
            if ((msg.role === 'user' || msg.role === 'assistant') && msg.content) {
              messages.push({ role: msg.role, content: msg.content });
            }
          }
        }
      }
      
      // Add current user message
      messages.push({ role: 'user', content: user_message });

      // Build and call Anthropic API
      const anthropicRequest = buildAnthropicRequest(
        modelConfig?.apiModelId || modelId,
        messages,
        {
          systemPrompt: systemContent,
          maxTokens: maxTokens || modelConfig?.maxOutputTokens || 4096,
          temperature: modelSupportsTemp ? temperature : undefined,
          topP: modelSupportsTemp ? topP : undefined,
        }
      );

      console.log('Calling Anthropic Messages API:', {
        model: anthropicRequest.model,
        messageCount: messages.length,
        hasSystem: !!systemContent,
      });

      try {
        const anthropicResponse = await callAnthropicAPI(anthropicApiKey, anthropicRequest);
        const parsed = parseAnthropicResponse(anthropicResponse);
        
        responseText = parsed.content;
        usage = parsed.usage;
        newResponseId = parsed.responseId;
        
        console.log('Anthropic response received:', newResponseId);
      } catch (error) {
        console.error('Anthropic API error:', error);
        const message = error instanceof Error ? error.message : 'Anthropic API call failed';
        return new Response(
          JSON.stringify({ error: message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store messages in local table for history reconstruction
      if (activeThreadRowId) {
        await supabase.from('q_prompt_family_messages').insert([
          { thread_row_id: activeThreadRowId, role: 'user', content: user_message },
          { thread_row_id: activeThreadRowId, role: 'assistant', content: responseText },
        ]);
      }

    } else {
      // --- OPENAI PROVIDER (default) ---
      
      // Build API request body for Responses API
      const apiRequestBody: any = {
        model: modelId,
        input: user_message,
      };

      // Use previous_response_id for multi-turn chaining (GPT-5 safe)
      if (lastResponseId?.startsWith('resp_')) {
        apiRequestBody.previous_response_id = lastResponseId;
        console.log('Continuing from previous response:', lastResponseId);
      } else {
        console.log('No previous_response_id - starting fresh conversation turn');
      }

      // Add instructions if present
      if (systemContent && systemContent.trim()) {
        apiRequestBody.instructions = systemContent.trim();
      }

      if (modelSupportsTemp && temperature !== undefined && !isNaN(temperature)) {
        apiRequestBody.temperature = temperature;
      }
      if (modelSupportsTemp && topP !== undefined && !isNaN(topP)) {
        apiRequestBody.top_p = topP;
      }
      if (maxTokens !== undefined && !isNaN(maxTokens)) {
        apiRequestBody.max_output_tokens = maxTokens;
      }

      console.log('Calling Responses API for Studio chat:', { 
        model: modelId, 
        previous_response_id: lastResponseId,
        hasInstructions: !!apiRequestBody.instructions,
      });

      // Call Responses API
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequestBody),
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
      newResponseId = responseData.id;

      // Extract response content from Responses API format
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

      // Extract usage
      usage = {
        prompt_tokens: responseData.usage?.input_tokens || 0,
        completion_tokens: responseData.usage?.output_tokens || 0,
        total_tokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0),
      };
    }

    // Update thread record
    if (activeThreadRowId) {
      const updateData: any = { last_message_at: new Date().toISOString() };
      if (newResponseId) {
        updateData.last_response_id = newResponseId;
      }
      await supabase
        .from(TABLES.THREADS)
        .update(updateData)
        .eq('row_id', activeThreadRowId);
    }

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
