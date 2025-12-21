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

// Handle Confluence tool calls
async function handleConfluenceTool(
  toolName: string,
  args: any,
  supabase: any
): Promise<string> {
  // Fetch Confluence config from settings
  const { data: settings } = await supabase
    .from(TABLES.SETTINGS)
    .select('setting_key, setting_value')
    .in('setting_key', ['confluence_base_url', 'confluence_email', 'confluence_api_token']);

  const config: Record<string, string> = {};
  for (const s of settings || []) {
    config[s.setting_key] = s.setting_value;
  }

  if (!config.confluence_base_url || !config.confluence_email || !config.confluence_api_token) {
    return JSON.stringify({ error: 'Confluence not configured. Please set up Confluence credentials in Settings.' });
  }

  const authHeader = 'Basic ' + btoa(`${config.confluence_email}:${config.confluence_api_token}`);

  try {
    if (toolName === 'confluence_search') {
      const { query, space_key } = args;
      let cql = `text ~ "${query}"`;
      if (space_key) {
        cql += ` AND space = "${space_key}"`;
      }
      
      const url = `${config.confluence_base_url}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=10`;
      const response = await fetch(url, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      });

      if (!response.ok) {
        return JSON.stringify({ error: `Confluence API error: ${response.status}` });
      }

      const data = await response.json();
      const results = (data.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        space: r._expandable?.space?.split('/').pop(),
        url: `${config.confluence_base_url}/wiki${r._links?.webui}`,
      }));

      return JSON.stringify({ results, total: data.totalSize || results.length });
    }

    if (toolName === 'confluence_read') {
      const { page_id } = args;
      const url = `${config.confluence_base_url}/wiki/rest/api/content/${page_id}?expand=body.storage,space`;
      const response = await fetch(url, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      });

      if (!response.ok) {
        return JSON.stringify({ error: `Confluence API error: ${response.status}` });
      }

      const data = await response.json();
      const contentHtml = data.body?.storage?.value || '';
      const contentText = htmlToText(contentHtml);

      return JSON.stringify({
        id: data.id,
        title: data.title,
        space: data.space?.name,
        content: contentText.substring(0, 15000),
        url: `${config.confluence_base_url}/wiki${data._links?.webui}`,
      });
    }

    if (toolName === 'confluence_list_children') {
      const { page_id } = args;
      const url = `${config.confluence_base_url}/wiki/rest/api/content/${page_id}/child/page?limit=25`;
      const response = await fetch(url, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      });

      if (!response.ok) {
        return JSON.stringify({ error: `Confluence API error: ${response.status}` });
      }

      const data = await response.json();
      const children = (data.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        url: `${config.confluence_base_url}/wiki${r._links?.webui}`,
      }));

      return JSON.stringify({ children, total: data.size || children.length });
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
  supabase: any
): Promise<ResponsesAPIResult> {
  const modelId = assistantData.model_override || 'gpt-4o';
  
  // Build tools array using shared module
  const tools = getAllTools({
    codeInterpreterEnabled: toolConfig.code_interpreter_enabled,
    fileSearchEnabled: toolConfig.file_search_enabled,
    webSearchEnabled: toolConfig.web_search_enabled,
    confluenceEnabled: toolConfig.confluence_enabled,
    vectorStoreIds: vectorStoreId ? [vectorStoreId] : undefined,
  });

  // Build input
  const input: any[] = [];
  
  // Add system instructions if present
  if (assistantData.instructions) {
    input.push({
      role: 'system',
      content: assistantData.instructions,
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
    store: true, // Persist to conversation state
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
          output = await handleConfluenceTool(functionName, args, supabase);
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
      store: true,
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
    const { child_prompt_row_id, user_message, template_variables, child_thread_strategy: requestStrategy } = await req.json();

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

    // Fetch attached Confluence pages for context injection
    const { data: confluencePages } = await supabase
      .from(TABLES.CONFLUENCE_PAGES)
      .select('page_title, content_text, openai_file_id')
      .or(`assistant_row_id.eq.${assistantData.row_id},prompt_row_id.eq.${child_prompt_row_id}`);

    // Build Confluence context from attached pages
    let confluenceContext = '';

    if (confluencePages && confluencePages.length > 0) {
      const textPages = confluencePages.filter((p: any) => p.content_text && !p.openai_file_id);

      if (textPages.length > 0) {
        confluenceContext = textPages
          .map((p: any) => `## ${p.page_title}\n${p.content_text}`)
          .join('\n\n---\n\n');
        confluenceContext = `[Attached Confluence Context]\n${confluenceContext}\n\n---\n\n`;
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

    // Prepend Confluence context if available
    if (confluenceContext) {
      finalMessage = confluenceContext + finalMessage;
    }

    if (!finalMessage.trim()) {
      return new Response(
        JSON.stringify({ error: 'No message to send' }),
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

    const result = await runWithResponsesAPI(
      assistantData,
      finalMessage,
      conversationId,
      toolConfig,
      assistantData.vector_store_id,
      OPENAI_API_KEY,
      supabase
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error, error_code: result.error_code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update child prompt with response
    await supabase
      .from(TABLES.PROMPTS)
      .update({ output_response: result.response })
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