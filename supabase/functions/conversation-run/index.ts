import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { 
  getAllTools, 
  hasFunctionCalls, 
  extractTextFromResponseOutput 
} from "../_shared/tools.ts";

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

// Helper to strip HTML tags
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Handle Confluence tool calls - only for attached pages
async function handleConfluenceTool(
  toolName: string,
  args: any,
  attachedPages: Array<{ page_id: string; page_title: string; content_text: string | null; page_url: string | null }>
): Promise<string> {
  try {
    if (toolName === 'confluence_list_attached') {
      // List only the attached pages
      if (!attachedPages || attachedPages.length === 0) {
        return JSON.stringify({ 
          message: 'No Confluence pages are attached to this conversation. Ask the user to attach pages via the Conversation tab.',
          pages: []
        });
      }

      const pages = attachedPages.map(p => ({
        id: p.page_id,
        title: p.page_title,
        url: p.page_url,
      }));

      return JSON.stringify({ 
        message: `${pages.length} Confluence page(s) attached to this conversation.`,
        pages 
      });
    }

    if (toolName === 'confluence_read_attached') {
      const { page_id } = args;
      
      // Find the page in attached pages
      const page = attachedPages.find(p => p.page_id === page_id);
      
      if (!page) {
        // List available pages in error message
        const availableIds = attachedPages.map(p => p.page_id).join(', ');
        return JSON.stringify({ 
          error: `Page ${page_id} is not attached to this conversation. Available page IDs: ${availableIds || 'none'}`,
        });
      }

      return JSON.stringify({
        id: page.page_id,
        title: page.page_title,
        content: page.content_text || '(No content available - page may need to be synced)',
        url: page.page_url,
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (error) {
    console.error('Confluence tool error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: `Confluence request failed: ${message}` });
  }
}

// ============================================================================
// CREATE OPENAI CONVERSATION
// ============================================================================
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

// ============================================================================
// RESPONSES API HANDLER - Uses conversation parameter instead of previous_response_id
// ============================================================================

interface ResponsesAPIResult {
  success: boolean;
  response?: string;
  response_id?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
  error_code?: string;
}

async function runWithResponsesAPI(
  assistantData: any,
  message: string,
  conversationId: string,
  toolConfig: { code_interpreter_enabled: boolean; file_search_enabled: boolean; confluence_enabled: boolean; web_search_enabled: boolean },
  vectorStoreId: string | null,
  apiKey: string,
  attachedPages: Array<{ page_id: string; page_title: string; content_text: string | null; page_url: string | null }>,
  adminPrompt?: string, // Optional admin prompt to include as additional system context
  storeMessages: boolean = false // Whether to persist messages to conversation history
): Promise<ResponsesAPIResult> {
  const modelId = assistantData.model_override || 'gpt-4o';
  
  // Get attached page IDs for Confluence tools
  const attachedConfluencePageIds = attachedPages.map(p => p.page_id);
  
  // Build tools array using shared module
  const tools = getAllTools({
    codeInterpreterEnabled: toolConfig.code_interpreter_enabled,
    fileSearchEnabled: toolConfig.file_search_enabled,
    webSearchEnabled: toolConfig.web_search_enabled,
    confluenceEnabled: toolConfig.confluence_enabled,
    vectorStoreIds: vectorStoreId ? [vectorStoreId] : undefined,
    attachedConfluencePageIds,
  });

  // Build input
  const input: any[] = [];
  
  // Add system instructions if present (from assistant configuration)
  if (assistantData.instructions) {
    input.push({
      role: 'system',
      content: assistantData.instructions,
    });
  }
  
  // Add admin prompt as additional system context if present
  if (adminPrompt && adminPrompt.trim()) {
    input.push({
      role: 'system',
      content: adminPrompt.trim(),
    });
  }
  
  // Add user message
  input.push({
    role: 'user',
    content: message,
  });

  const requestBody: any = {
    model: modelId,
    input,
    tools: tools.length > 0 ? tools : undefined,
    // Use conversation parameter for multi-turn conversations
    conversation: conversationId,
    // Prevent cascade/prompt runs from polluting chat history unless explicitly enabled
    store: storeMessages,
  };

  // Add model parameters if set
  const temperature = assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined;
  const topP = assistantData.top_p_override ? parseFloat(assistantData.top_p_override) : undefined;
  const maxTokens = assistantData.max_tokens_override ? parseInt(assistantData.max_tokens_override, 10) : undefined;

  if (temperature !== undefined && !isNaN(temperature)) requestBody.temperature = temperature;
  if (topP !== undefined && !isNaN(topP)) requestBody.top_p = topP;
  if (maxTokens !== undefined && !isNaN(maxTokens)) requestBody.max_output_tokens = maxTokens;

  console.log('Calling Responses API with conversation:', { 
    model: modelId, 
    toolCount: tools.length,
    conversationId,
  });

  // Call Responses API
  let response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Responses API error:', error);
    return { 
      success: false, 
      error: error.error?.message || 'Responses API call failed',
      error_code: 'API_CALL_FAILED',
    };
  }

  let responseData = await response.json();
  console.log('Responses API response:', { 
    id: responseData.id, 
    outputCount: responseData.output?.length,
    status: responseData.status,
  });

  // Handle function calls in a loop
  let maxIterations = 10;
  let iteration = 0;

  while (hasFunctionCalls(responseData.output) && iteration < maxIterations) {
    iteration++;
    console.log(`Processing function calls, iteration ${iteration}`);

    const functionCallOutputs: any[] = [];

    for (const item of responseData.output || []) {
      if (item.type === 'function_call') {
        const functionName = item.name;
        let args: any;
        try {
          args = typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments;
        } catch (parseError) {
          console.error('Failed to parse function arguments:', parseError);
          functionCallOutputs.push({
            type: 'function_call_output',
            call_id: item.call_id,
            output: JSON.stringify({ error: 'Invalid function arguments' }),
          });
          continue;
        }
        
        console.log('Executing function:', functionName, args);

        let output: string;
        if (functionName.startsWith('confluence_')) {
          output = await handleConfluenceTool(functionName, args, attachedPages);
        } else {
          output = JSON.stringify({ error: `Unknown function: ${functionName}` });
        }

        functionCallOutputs.push({
          type: 'function_call_output',
          call_id: item.call_id,
          output,
        });
      }
    }

    if (functionCallOutputs.length === 0) break;

    // Submit function outputs - use conversation parameter
    const continueBody: any = {
      model: modelId,
      conversation: conversationId,
      input: functionCallOutputs,
      tools: tools.length > 0 ? tools : undefined,
      store: storeMessages,
    };

    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(continueBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Responses API continuation error:', error);
      return { 
        success: false, 
        error: error.error?.message || 'Failed to continue after function call',
        error_code: 'TOOL_CONTINUATION_FAILED',
      };
    }

    responseData = await response.json();
    console.log('Continued response:', { 
      id: responseData.id, 
      outputCount: responseData.output?.length,
    });
  }

  // Check if we hit max iterations
  if (iteration >= maxIterations) {
    console.error('Max function call iterations reached');
    return {
      success: false,
      error: 'Maximum function call iterations exceeded.',
      error_code: 'MAX_ITERATIONS_EXCEEDED',
    };
  }

  // Extract text from final response
  const responseText = extractTextFromResponseOutput(responseData.output);

  // Extract usage
  const usage = {
    prompt_tokens: responseData.usage?.input_tokens || 0,
    completion_tokens: responseData.usage?.output_tokens || 0,
    total_tokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0),
  };

  return {
    success: true,
    response: responseText,
    response_id: responseData.id,
    usage,
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
    const { child_prompt_row_id, user_message, template_variables, child_thread_strategy: requestStrategy, store_messages: storeMessagesParam } = await req.json();
    
    // Default to NOT storing messages - cascade runs and individual runs should not pollute chat history
    // Only explicit chat interactions (studio-chat) should store messages
    const storeMessages = storeMessagesParam === true;

    console.log('Conversation run request:', { child_prompt_row_id, user: validation.user?.email, requestStrategy });

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

    // Fetch attached Confluence pages for context injection and tool access
    const { data: confluencePages } = await supabase
      .from(TABLES.CONFLUENCE_PAGES)
      .select('page_id, page_title, content_text, page_url, openai_file_id')
      .or(`assistant_row_id.eq.${assistantData.row_id},prompt_row_id.eq.${child_prompt_row_id}`);
    
    // Transform to expected format for tools
    const attachedPages = (confluencePages || []).map((p: any) => ({
      page_id: p.page_id,
      page_title: p.page_title,
      content_text: p.content_text,
      page_url: p.page_url,
    }));

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
        // Only inject text-based files directly
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

    // Build Confluence context from ALL attached pages (inject directly for reliability)
    let confluenceContext = '';
    if (confluencePages && confluencePages.length > 0) {
      // Include ALL pages with content, not just those without openai_file_id
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

    // Determine thread strategy
    const childThreadStrategy = requestStrategy || childPrompt.child_thread_strategy || 'isolated';
    const threadMode = childPrompt.thread_mode || 'new';
    
    console.log('Thread strategy:', childThreadStrategy, 'Thread mode:', threadMode);

    // Find or create OpenAI conversation
    let conversationId: string;
    let threadRowId: string | null = null;

    if (childThreadStrategy === 'parent' || threadMode === 'reuse') {
      // Look for existing thread with valid OpenAI conversation
      const threadQuery = supabase
        .from(TABLES.THREADS)
        .select('row_id, openai_conversation_id')
        .eq('assistant_row_id', assistantData.row_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (childThreadStrategy === 'parent') {
        threadQuery.is('child_prompt_row_id', null);
      } else {
        threadQuery.eq('child_prompt_row_id', child_prompt_row_id);
      }

      const { data: existingThread } = await threadQuery.maybeSingle();

      if (existingThread && existingThread.openai_conversation_id && !existingThread.openai_conversation_id.startsWith('pending_')) {
        // Use existing conversation
        conversationId = existingThread.openai_conversation_id;
        threadRowId = existingThread.row_id;
        console.log('Using existing conversation:', conversationId);
      } else if (existingThread && existingThread.openai_conversation_id?.startsWith('pending_')) {
        // Thread exists but needs OpenAI conversation created
        conversationId = await createOpenAIConversation(OPENAI_API_KEY, {
          assistant_row_id: assistantData.row_id,
          child_prompt_row_id: child_prompt_row_id || '',
        });
        threadRowId = existingThread.row_id;
        
        // Update thread with real conversation ID
        await supabase
          .from(TABLES.THREADS)
          .update({ openai_conversation_id: conversationId })
          .eq('row_id', threadRowId);
      } else {
        // No existing thread, create new conversation
        conversationId = await createOpenAIConversation(OPENAI_API_KEY, {
          assistant_row_id: assistantData.row_id,
          child_prompt_row_id: child_prompt_row_id || '',
        });
        
        // Create new thread
        const { data: newThread } = await supabase
          .from(TABLES.THREADS)
          .insert({
            assistant_row_id: assistantData.row_id,
            child_prompt_row_id: childThreadStrategy === 'parent' ? null : child_prompt_row_id,
            openai_conversation_id: conversationId,
            name: childThreadStrategy === 'parent' ? 'Studio Thread' : `Thread ${new Date().toISOString().split('T')[0]}`,
            is_active: true,
          })
          .select()
          .single();

        threadRowId = newThread?.row_id || null;
        console.log('Created new thread with conversation:', conversationId);
      }
    } else {
      // Isolated mode - always create new conversation
      conversationId = await createOpenAIConversation(OPENAI_API_KEY, {
        assistant_row_id: assistantData.row_id,
        child_prompt_row_id: child_prompt_row_id,
      });
      console.log('Created isolated conversation:', conversationId);
    }

    // Call Responses API with conversation
    const toolConfig = {
      code_interpreter_enabled: assistantData.code_interpreter_enabled || false,
      file_search_enabled: assistantData.file_search_enabled || false,
      confluence_enabled: assistantData.confluence_enabled || false,
      web_search_enabled: childPrompt.web_search_on || false,
    };

    // Get admin prompt from child prompt (applies template variables)
    const adminPrompt = childPrompt.input_admin_prompt 
      ? applyTemplate(childPrompt.input_admin_prompt, variables)
      : undefined;

    const result = await runWithResponsesAPI(
      assistantData,
      finalMessage,
      conversationId,
      toolConfig,
      assistantData.vector_store_id,
      OPENAI_API_KEY,
      attachedPages,
      adminPrompt,
      storeMessages
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

      // Map OpenAI rate limits to HTTP 429 so clients can backoff.
      if (result.error_code === 'API_CALL_FAILED' && /rate limit/i.test(errorText)) {
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

    // Update child prompt with response (user_prompt_result matches the UI field)
    await supabase
      .from(TABLES.PROMPTS)
      .update({ user_prompt_result: result.response })
      .eq('row_id', child_prompt_row_id);

    // Update thread timestamp if exists
    if (threadRowId) {
      await supabase
        .from(TABLES.THREADS)
        .update({ last_message_at: new Date().toISOString() })
        .eq('row_id', threadRowId);
    }

    const modelUsed = assistantData.model_override || 'gpt-4o';
    console.log('Run completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        response: result.response,
        response_id: result.response_id,
        usage: result.usage,
        model: modelUsed,
        child_prompt_name: childPrompt.prompt_name,
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