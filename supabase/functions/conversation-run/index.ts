import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

// Template variable substitution
function applyTemplate(template: string, variables: Record<string, string>): string {
  if (!template) return '';
  
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Generate a unique conversation ID (we use UUID since we're using Chat Completions API)
function generateConversationId(): string {
  return 'conv_' + crypto.randomUUID().replace(/-/g, '');
}

// ============================================================================
// CHAT COMPLETIONS API HANDLER
// ============================================================================

interface ChatCompletionsResult {
  success: boolean;
  response?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
  error_code?: string;
  response_id?: string;
}

async function runChatCompletions(
  assistantData: any,
  userMessage: string,
  systemPrompt: string,
  apiKey: string,
): Promise<ChatCompletionsResult> {
  const requestedModel = assistantData.model_override || 'gpt-4o-mini';
  const modelId = resolveModelId(requestedModel);
  
  // Check if model supports temperature
  const isNoTempModel = NO_TEMPERATURE_MODELS.some(m => modelId.toLowerCase().includes(m));

  // Build messages array
  const messages: any[] = [];
  
  // Add system message if present
  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }
  
  // Add user message
  messages.push({ role: 'user', content: userMessage });

  // Build request body for Chat Completions API
  const requestBody: any = {
    model: modelId,
    messages,
  };

  // Add model parameters if set
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

  console.log('Calling Chat Completions API:', { 
    model: modelId, 
    messageCount: messages.length,
    hasSystemPrompt: !!systemPrompt,
  });

  // Call Chat Completions API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Chat Completions API error:', error);
    
    // Check for rate limiting
    const errorMessage = error.error?.message || 'Chat Completions API call failed';
    const isRateLimit = response.status === 429;
    
    return { 
      success: false, 
      error: errorMessage,
      error_code: isRateLimit ? 'RATE_LIMITED' : 'API_CALL_FAILED',
    };
  }

  const responseData = await response.json();
  console.log('Chat Completions API response received:', responseData.id);

  // Extract response content
  const responseText = responseData.choices?.[0]?.message?.content || '';

  // Extract usage
  const usage = {
    prompt_tokens: responseData.usage?.prompt_tokens || 0,
    completion_tokens: responseData.usage?.completion_tokens || 0,
    total_tokens: responseData.usage?.total_tokens || 0,
  };

  return {
    success: true,
    response: responseText,
    usage,
    response_id: responseData.id,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { 
      child_prompt_row_id, 
      user_message, 
      template_variables,
      thread_row_id,
      thread_mode,
      child_thread_strategy,
      existing_thread_row_id,
    } = await req.json();

    console.log('Conversation run request:', { 
      child_prompt_row_id, 
      user: validation.user?.email,
      thread_row_id,
      thread_mode,
    });

    // Fetch child prompt with parent info
    const { data: childPrompt, error: promptError } = await supabase
      .from(TABLES.PROMPTS)
      .select('*, parent:parent_row_id(row_id, is_assistant)')
      .eq('row_id', child_prompt_row_id)
      .single();

    if (promptError || !childPrompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get parent assistant
    const parentRowId = childPrompt.parent_row_id;
    if (!parentRowId) {
      return new Response(
        JSON.stringify({ error: 'No parent prompt found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: parentPrompt } = await supabase
      .from(TABLES.PROMPTS)
      .select('is_assistant')
      .eq('row_id', parentRowId)
      .single();

    if (!parentPrompt?.is_assistant) {
      return new Response(
        JSON.stringify({ error: 'Parent is not an assistant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch assistant config
    const { data: assistant, error: assistantError } = await supabase
      .from(TABLES.ASSISTANTS)
      .select('*')
      .eq('prompt_row_id', parentRowId)
      .single();

    if (assistantError || !assistant) {
      return new Response(
        JSON.stringify({ error: 'Assistant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistantData = assistant as any;

    // Determine which thread/conversation to use
    let conversationId: string | null = null;
    let activeThreadRowId: string | null = thread_row_id || existing_thread_row_id || null;

    // Try to get existing thread's conversation ID
    if (activeThreadRowId) {
      const { data: existingThread } = await supabase
        .from(TABLES.THREADS)
        .select('openai_conversation_id')
        .eq('row_id', activeThreadRowId)
        .single();
      
      if (existingThread?.openai_conversation_id) {
        conversationId = existingThread.openai_conversation_id;
        console.log('Using existing conversation:', conversationId);
      }
    }

    // Create new conversation if needed
    if (!conversationId) {
      conversationId = generateConversationId();

      // Create thread record
      const { data: newThread } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id: assistantData.row_id,
          child_prompt_row_id: child_prompt_row_id,
          openai_conversation_id: conversationId,
          name: `${childPrompt.prompt_name} - ${new Date().toLocaleDateString()}`,
          is_active: true,
          owner_id: validation.user?.id,
        })
        .select()
        .single();

      if (newThread) {
        activeThreadRowId = newThread.row_id;
        console.log('Created new thread:', activeThreadRowId);
      }
    }

    // Fetch attached Confluence pages for context injection
    const { data: confluencePages } = await supabase
      .from(TABLES.CONFLUENCE_PAGES)
      .select('page_id, page_title, content_text, page_url')
      .or(`assistant_row_id.eq.${assistantData.row_id},prompt_row_id.eq.${child_prompt_row_id}`);

    // Fetch attached files for direct context injection
    const { data: assistantFiles } = await supabase
      .from(TABLES.ASSISTANT_FILES)
      .select('original_filename, storage_path, mime_type')
      .eq('assistant_row_id', assistantData.row_id);

    // Build file context from attached files (read text-based files directly)
    let fileContext = '';
    if (assistantFiles && assistantFiles.length > 0) {
      const textMimeTypes = [
        'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
        'application/json', 'application/xml', 'text/x-markdown'
      ];
      
      for (const file of assistantFiles) {
        const isTextFile = textMimeTypes.some(t => file.mime_type?.startsWith(t)) ||
          file.original_filename?.match(/\.(txt|md|csv|json|xml|html|yml|yaml|log)$/i);
        
        if (isTextFile && file.storage_path) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('assistant-files')
              .download(file.storage_path);
            
            if (!downloadError && fileData) {
              const content = await fileData.text();
              if (content && content.trim()) {
                fileContext += `## File: ${file.original_filename}\n${content}\n\n---\n\n`;
              }
            }
          } catch (err) {
            console.warn('Could not read file:', file.original_filename, err);
          }
        }
      }
      
      if (fileContext) {
        fileContext = `[Attached Files Content]\n${fileContext}`;
      }
    }

    // Build Confluence context from attached pages
    let confluenceContext = '';
    if (confluencePages && confluencePages.length > 0) {
      const textPages = confluencePages.filter((p: any) => p.content_text);

      if (textPages.length > 0) {
        confluenceContext = textPages
          .map((p: any) => `## ${p.page_title}\n${p.content_text}`)
          .join('\n\n---\n\n');
        confluenceContext = `[Attached Confluence Pages]\n${confluenceContext}\n\n---\n\n`;
      }
    }

    // Build template variables from prompt fields
    const variables: Record<string, string> = {
      input_admin_prompt: childPrompt.input_admin_prompt || '',
      input_user_prompt: childPrompt.input_user_prompt || '',
      admin_prompt_result: childPrompt.admin_prompt_result || '',
      user_prompt_result: childPrompt.user_prompt_result || '',
      output_response: childPrompt.output_response || '',
      ...template_variables,
    };

    // Apply template to user message
    let finalMessage = user_message 
      ? applyTemplate(user_message, variables)
      : childPrompt.input_user_prompt || '';

    // Prepend file context if available
    if (fileContext) {
      finalMessage = fileContext + finalMessage;
    }

    // Prepend Confluence context if available
    if (confluenceContext) {
      finalMessage = confluenceContext + finalMessage;
    }

    if (!finalMessage.trim()) {
      console.error('No message to send for prompt:', {
        child_prompt_row_id,
        prompt_name: childPrompt.prompt_name,
        has_user_prompt: !!childPrompt.input_user_prompt,
        has_admin_prompt: !!childPrompt.input_admin_prompt,
        has_user_message: !!user_message,
      });
      return new Response(
        JSON.stringify({ 
          error: `No message to send for prompt "${childPrompt.prompt_name}". Add content to the user prompt or admin prompt field.`,
          error_code: 'NO_MESSAGE_CONTENT',
          prompt_name: childPrompt.prompt_name,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt from assistant instructions + admin prompt
    let systemPrompt = assistantData.instructions || '';
    
    // Add admin prompt as additional system context if present
    const adminPrompt = childPrompt.input_admin_prompt 
      ? applyTemplate(childPrompt.input_admin_prompt, variables)
      : '';
    
    if (adminPrompt && adminPrompt.trim()) {
      systemPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${adminPrompt.trim()}`
        : adminPrompt.trim();
    }

    // Call Chat Completions API
    const result = await runChatCompletions(
      assistantData,
      finalMessage,
      systemPrompt,
      OPENAI_API_KEY
    );

    if (!result.success) {
      const errorText = result.error || 'Responses API call failed';

      console.error('Responses API failed:', {
        child_prompt_row_id,
        prompt_name: childPrompt.prompt_name,
        error: errorText,
        error_code: result.error_code,
      });

      let status = 400;
      let retryAfterS: number | null = null;

      // Map rate limits to HTTP 429
      if (result.error_code === 'RATE_LIMITED' || /rate limit/i.test(errorText)) {
        status = 429;
        const match = /try again in ([0-9.]+)s/i.exec(errorText);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          if (!Number.isNaN(parsed) && parsed > 0) retryAfterS = parsed;
        }
      }

      const body: Record<string, unknown> = {
        error: errorText,
        error_code: result.error_code,
        prompt_name: childPrompt.prompt_name,
        ...(retryAfterS ? { retry_after_s: retryAfterS } : {}),
      };

      const headers: Record<string, string> = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(retryAfterS ? { 'Retry-After': String(Math.ceil(retryAfterS)) } : {}),
      };

      return new Response(JSON.stringify(body), { status, headers });
    }

    // Update child prompt with response
    await supabase
      .from(TABLES.PROMPTS)
      .update({ user_prompt_result: result.response })
      .eq('row_id', child_prompt_row_id);

    // Update thread's last_message_at and last_response_id
    if (activeThreadRowId) {
      await supabase
        .from(TABLES.THREADS)
        .update({ 
          last_message_at: new Date().toISOString(),
          last_response_id: result.response_id,
        })
        .eq('row_id', activeThreadRowId);
    }

    const modelUsed = assistantData.model_override || 'gpt-4o-mini';
    console.log('Run completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        response: result.response,
        usage: result.usage,
        model: modelUsed,
        child_prompt_name: childPrompt.prompt_name,
        thread_row_id: activeThreadRowId,
        conversation_id: conversationId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Conversation run error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
