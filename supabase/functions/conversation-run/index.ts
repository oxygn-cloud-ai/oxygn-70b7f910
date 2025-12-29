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
async function resolveModelFromDb(supabase: any, modelId: string): Promise<string> {
  try {
    return await resolveApiModelId(supabase, modelId);
  } catch {
    return modelId;
  }
}

// Check if model supports temperature from DB
async function modelSupportsTemperatureDb(supabase: any, modelId: string): Promise<boolean> {
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

// Template variable substitution - handles both regular {{var}} and system {{q.var}} patterns
function applyTemplate(template: string, variables: Record<string, string>): string {
  if (!template) return '';
  
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Escape special regex characters in the key (important for q.* variables with dots)
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
    result = result.replace(regex, value ?? '');
  }
  return result;
}

// ============================================================================
// OPENAI RESPONSES API
// https://platform.openai.com/docs/api-reference/responses
// Multi-turn conversations use previous_response_id for context chaining
// ============================================================================

interface ResponsesResult {
  success: boolean;
  response?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
  error_code?: string;
  response_id?: string;
}

// Default system prompt for action nodes - instructs AI to respond with JSON
const DEFAULT_ACTION_SYSTEM_PROMPT = `You are an AI assistant that responds ONLY with valid JSON according to the provided schema.

CRITICAL INSTRUCTIONS:
1. Your response must be ONLY valid JSON - no markdown, no explanations, no additional text
2. Do not wrap your response in code blocks or backticks
3. Follow the exact schema structure provided
4. Include all required fields
5. Use appropriate data types as specified in the schema

{{schema_description}}

Respond with the JSON object now.`;

// Format JSON schema for human-readable prompt
function formatSchemaForPrompt(schema: any): string {
  if (!schema) return '';
  
  const lines: string[] = ['Expected JSON Schema:'];
  
  if (schema.type === 'object' && schema.properties) {
    lines.push('{');
    for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
      const isRequired = schema.required?.includes(key);
      const reqMarker = isRequired ? ' (required)' : ' (optional)';
      
      if (prop.type === 'array' && prop.items) {
        const itemType = prop.items.type || 'object';
        lines.push(`  "${key}": Array<${itemType}>${reqMarker}`);
        if (prop.items.properties) {
          lines.push('    Each item: {');
          for (const [itemKey, itemProp] of Object.entries(prop.items.properties) as [string, any][]) {
            const itemReq = prop.items.required?.includes(itemKey) ? ' (required)' : '';
            lines.push(`      "${itemKey}": ${itemProp.type || 'any'}${itemReq}`);
          }
          lines.push('    }');
        }
      } else if (prop.type === 'object' && prop.properties) {
        lines.push(`  "${key}": {${reqMarker}`);
        for (const [subKey, subProp] of Object.entries(prop.properties) as [string, any][]) {
          lines.push(`    "${subKey}": ${(subProp as any).type || 'any'}`);
        }
        lines.push('  }');
      } else {
        const enumVals = prop.enum ? ` (one of: ${prop.enum.join(', ')})` : '';
        lines.push(`  "${key}": ${prop.type || 'any'}${reqMarker}${enumVals}`);
      }
    }
    lines.push('}');
  } else if (schema.type === 'array') {
    lines.push(`Array<${schema.items?.type || 'any'}>`);
  }
  
  return lines.join('\n');
}

// Call OpenAI Responses API - uses previous_response_id for multi-turn context
async function runResponsesAPI(
  assistantData: any,
  userMessage: string,
  systemPrompt: string,
  previousResponseId: string | null,
  apiKey: string,
  supabase: any,
  options: {
    responseFormat?: any;
    seed?: number;
    toolChoice?: string;
    reasoningEffort?: string;
  } = {},
): Promise<ResponsesResult> {
  // Use DB for model resolution
  const defaultModel = await getDefaultModelFromSettings(supabase);
  const requestedModel = assistantData.model_override || defaultModel;
  const modelId = await resolveModelFromDb(supabase, requestedModel);
  const modelSupportsTemp = await modelSupportsTemperatureDb(supabase, requestedModel);
  
  // Build request body for Responses API
  const requestBody: any = {
    model: modelId,
    input: userMessage,
    store: true, // Store for multi-turn via previous_response_id
  };

  // Add previous_response_id for multi-turn conversation context
  if (previousResponseId) {
    requestBody.previous_response_id = previousResponseId;
  }

  // Add instructions (system prompt)
  if (systemPrompt && systemPrompt.trim()) {
    requestBody.instructions = systemPrompt.trim();
  }

  // Add structured output format if provided
  if (options.responseFormat && options.responseFormat.type === 'json_schema') {
    requestBody.text = {
      format: {
        type: 'json_schema',
        name: options.responseFormat.json_schema?.name || 'response',
        schema: options.responseFormat.json_schema?.schema,
        strict: options.responseFormat.json_schema?.strict ?? true,
      },
    };
    console.log('Using structured output format:', requestBody.text.format.name);
  }

  // Add model parameters if set
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

  // Add seed if provided
  if (options.seed !== undefined && !isNaN(options.seed)) {
    requestBody.seed = options.seed;
  }

  // Add reasoning effort if model supports it (get valid levels from DB)
  if (options.reasoningEffort) {
    const modelConfig = await fetchModelConfig(supabase, requestedModel);
    const validLevels = modelConfig?.reasoningEffortLevels || [];
    if (validLevels.length > 0 && validLevels.includes(options.reasoningEffort)) {
      requestBody.reasoning = { effort: options.reasoningEffort };
    }
  }

  console.log('Calling Responses API:', { 
    model: modelId, 
    hasPreviousResponse: !!previousResponseId,
    hasInstructions: !!systemPrompt,
    hasStructuredOutput: !!options.responseFormat,
    requestBody: JSON.stringify(requestBody),
  });

  // Call Responses API with timeout (5 minutes max)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
  
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('OpenAI API call timed out after 5 minutes');
      return {
        success: false,
        error: 'Request timed out after 5 minutes. The prompt may be too complex or OpenAI is experiencing delays.',
        error_code: 'TIMEOUT',
      };
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Responses API error:', response.status, errorText);
    
    let errorMessage = 'Responses API call failed';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    const isRateLimit = response.status === 429;
    
    return { 
      success: false, 
      error: errorMessage,
      error_code: isRateLimit ? 'RATE_LIMITED' : 'API_CALL_FAILED',
    };
  }

  const responseData = await response.json();
  console.log('Responses API response received:', responseData.id);

  // Extract response content from output array
  let responseText = '';
  if (responseData.output && Array.isArray(responseData.output)) {
    for (const item of responseData.output) {
      if (item.type === 'message' && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            responseText += contentItem.text;
          }
        }
      }
    }
  }

  // Extract usage
  const usage = {
    prompt_tokens: responseData.usage?.input_tokens || 0,
    completion_tokens: responseData.usage?.output_tokens || 0,
    total_tokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0),
  };

  return {
    success: true,
    response: responseText,
    usage,
    response_id: responseData.id,
  };
}

// ============================================================================
// SSE STREAMING RESPONSE HANDLER
// ============================================================================

interface SSEEmitter {
  emit: (event: any) => void;
  close: () => void;
}

function createSSEStream(): { stream: ReadableStream; emitter: SSEEmitter } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });
  
  const emitter: SSEEmitter = {
    emit: (event: any) => {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch (e) {
        console.warn('SSE emit error:', e);
      }
    },
    close: () => {
      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        console.warn('SSE close error:', e);
      }
    },
  };
  
  return { stream, emitter };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Create SSE stream for progress events
  const { stream, emitter } = createSSEStream();
  const startTime = Date.now();
  let heartbeatInterval: number | null = null;

  // Start heartbeat immediately
  heartbeatInterval = setInterval(() => {
    emitter.emit({ type: 'heartbeat', elapsed_ms: Date.now() - startTime });
  }, 10000);

  // Process request in background while streaming progress
  (async () => {
    try {
      // Validate user and domain
      const validation = await validateUser(req);
      if (!validation.valid) {
        console.error('Auth validation failed:', validation.error);
        emitter.emit({ type: 'error', error: validation.error, error_code: 'AUTH_FAILED' });
        return;
      }

      console.log('User validated:', validation.user?.email);

      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!OPENAI_API_KEY) {
        emitter.emit({ type: 'error', error: 'OpenAI API key not configured', error_code: 'CONFIG_ERROR' });
        return;
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

      // Emit started event
      emitter.emit({ type: 'started', prompt_row_id: child_prompt_row_id });

      // Fetch child prompt with parent info
      const { data: childPrompt, error: promptError } = await supabase
        .from(TABLES.PROMPTS)
        .select('*, parent:parent_row_id(row_id, is_assistant)')
        .eq('row_id', child_prompt_row_id)
        .single();

      if (promptError || !childPrompt) {
        emitter.emit({ type: 'error', error: 'Prompt not found', error_code: 'NOT_FOUND' });
        return;
      }

      emitter.emit({ 
        type: 'progress', 
        stage: 'prompt_loaded', 
        prompt_name: childPrompt.prompt_name,
        elapsed_ms: Date.now() - startTime 
      });

      // Collect ALL assistant IDs from the hierarchy (for file inheritance)
      let assistantData: any = null;
      let topLevelPromptId: string | null = null;
      const allAssistantRowIds: string[] = [];
      
      // Check if current prompt has an assistant
      const { data: selfAssistant } = await supabase
        .from(TABLES.ASSISTANTS)
        .select('*')
        .eq('prompt_row_id', child_prompt_row_id)
        .single();
      
      if (selfAssistant) {
        assistantData = selfAssistant;
        topLevelPromptId = child_prompt_row_id;
        allAssistantRowIds.push(selfAssistant.row_id);
        console.log('Found assistant on current prompt:', child_prompt_row_id);
      }
      
      // Walk up the parent chain to collect ALL assistants in the hierarchy
      let currentPromptId = childPrompt.parent_row_id;
      const maxDepth = 10;
      let depth = 0;

      while (currentPromptId && depth < maxDepth) {
        depth++;
        
        const { data: parentAssistant } = await supabase
          .from(TABLES.ASSISTANTS)
          .select('*')
          .eq('prompt_row_id', currentPromptId)
          .single();
        
        if (parentAssistant) {
          allAssistantRowIds.push(parentAssistant.row_id);
          if (!assistantData) {
            assistantData = parentAssistant;
            topLevelPromptId = currentPromptId;
            console.log('Found assistant at depth', depth, ':', currentPromptId);
          } else {
            console.log('Found parent assistant at depth', depth, ':', parentAssistant.row_id);
          }
        }
        
        const { data: parentPrompt } = await supabase
          .from(TABLES.PROMPTS)
          .select('parent_row_id')
          .eq('row_id', currentPromptId)
          .single();
        
        currentPromptId = parentPrompt?.parent_row_id || null;
      }
      
      console.log('All assistant IDs in hierarchy:', allAssistantRowIds);

      // If no assistant configuration exists, create one automatically
      if (!assistantData) {
        console.log('No assistant found, auto-creating for prompt:', child_prompt_row_id);
        
        const { data: newAssistant, error: createAssistantError } = await supabase
          .from(TABLES.ASSISTANTS)
          .insert({
            prompt_row_id: child_prompt_row_id,
            name: childPrompt.prompt_name || 'Auto-created Assistant',
            instructions: '',
            use_global_tool_defaults: true,
            status: 'active',
            api_version: 'responses',
            owner_id: validation.user?.id,
          })
          .select()
          .single();
        
        if (createAssistantError) {
          console.error('Failed to create assistant:', createAssistantError);
          emitter.emit({ type: 'error', error: 'Failed to create assistant configuration', error_code: 'ASSISTANT_CREATE_FAILED' });
          return;
        }
        
        assistantData = newAssistant;
        topLevelPromptId = child_prompt_row_id;
        allAssistantRowIds.push(newAssistant.row_id);
        console.log('Auto-created assistant:', newAssistant.row_id);
      }

      // Determine which thread to use and get previous response ID for chaining
      let activeThreadRowId: string | null = thread_row_id || existing_thread_row_id || null;
      let previousResponseId: string | null = null;

      // ============================================================================
      // CONVERSATIONAL MEMORY: If child prompt has is_assistant=true (inherited),
      // look for the parent's active thread to chain context
      // ============================================================================
      if (!activeThreadRowId && childPrompt.is_assistant && childPrompt.parent_row_id) {
        console.log('Child prompt has is_assistant=true, looking for parent thread context...');
        
        // Find the most recent active thread for the parent's assistant
        const { data: parentThread } = await supabase
          .from(TABLES.THREADS)
          .select('row_id, last_response_id, assistant_row_id')
          .eq('child_prompt_row_id', childPrompt.parent_row_id)
          .eq('is_active', true)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        
        if (parentThread?.last_response_id) {
          // Use the parent's thread and its last response for context chaining
          activeThreadRowId = parentThread.row_id;
          previousResponseId = parentThread.last_response_id;
          console.log('Inheriting parent thread context:', {
            parent_prompt: childPrompt.parent_row_id,
            thread: activeThreadRowId,
            previous_response_id: previousResponseId,
          });
        } else {
          // No parent thread with response - check if parent's assistant has any thread
          const topLevelAssistantId = allAssistantRowIds[allAssistantRowIds.length - 1]; // Last one is the top-level
          if (topLevelAssistantId) {
            const { data: topThread } = await supabase
              .from(TABLES.THREADS)
              .select('row_id, last_response_id')
              .eq('assistant_row_id', topLevelAssistantId)
              .eq('is_active', true)
              .order('last_message_at', { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle();
            
            if (topThread?.last_response_id) {
              activeThreadRowId = topThread.row_id;
              previousResponseId = topThread.last_response_id;
              console.log('Using top-level assistant thread:', {
                assistant: topLevelAssistantId,
                thread: activeThreadRowId,
                previous_response_id: previousResponseId,
              });
            }
          }
        }
      }

      // Try to get existing thread's last response ID for multi-turn context
      if (activeThreadRowId && !previousResponseId) {
        const { data: existingThread } = await supabase
          .from(TABLES.THREADS)
          .select('last_response_id')
          .eq('row_id', activeThreadRowId)
          .single();
        
        if (existingThread?.last_response_id) {
          previousResponseId = existingThread.last_response_id;
          console.log('Using previous response for context:', previousResponseId);
        }
      }

      // Create a new thread record if none exists
      if (!activeThreadRowId) {
        const { data: newThread } = await supabase
          .from(TABLES.THREADS)
          .insert({
            assistant_row_id: assistantData.row_id,
            child_prompt_row_id: child_prompt_row_id,
            openai_conversation_id: `resp-thread-${Date.now()}`,
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

      // ============================================================================
      // OPTIMIZATION: Skip file/confluence loading when we have previous_response_id
      // OpenAI already has the context from previous turns
      // ============================================================================
      const isFollowUpMessage = !!previousResponseId;
      let fileContext = '';
      let confluenceContext = '';
      let filesCount = 0;
      let pagesCount = 0;

      if (!isFollowUpMessage) {
        emitter.emit({ 
          type: 'progress', 
          stage: 'loading_context', 
          message: 'Loading files and pages...',
          elapsed_ms: Date.now() - startTime 
        });

        // Fetch attached Confluence pages for context injection
        const { data: confluencePages } = await supabase
          .from(TABLES.CONFLUENCE_PAGES)
          .select('page_id, page_title, content_text, page_url')
          .or(`assistant_row_id.eq.${assistantData.row_id},prompt_row_id.eq.${child_prompt_row_id}`);

        // Fetch attached files from ALL assistants in the hierarchy
        let assistantFiles: any[] = [];
        if (allAssistantRowIds.length > 0) {
          const { data: files } = await supabase
            .from(TABLES.ASSISTANT_FILES)
            .select('original_filename, storage_path, mime_type')
            .in('assistant_row_id', allAssistantRowIds);
          assistantFiles = files || [];
          filesCount = assistantFiles.length;
          console.log(`Found ${assistantFiles.length} files from ${allAssistantRowIds.length} assistants in hierarchy`);
        }

        // Build file context from attached files (read text-based files directly)
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
        if (confluencePages && confluencePages.length > 0) {
          const textPages = confluencePages.filter((p: any) => p.content_text);
          pagesCount = textPages.length;

          if (textPages.length > 0) {
            confluenceContext = textPages
              .map((p: any) => `## ${p.page_title}\n${p.content_text}`)
              .join('\n\n---\n\n');
            confluenceContext = `[Attached Confluence Pages]\n${confluenceContext}\n\n---\n\n`;
          }
        }

        emitter.emit({ 
          type: 'progress', 
          stage: 'context_ready', 
          files_count: filesCount,
          pages_count: pagesCount,
          elapsed_ms: Date.now() - startTime 
        });
      } else {
        // Check if this is inherited context from parent thread
        const isInheritedContext = !!previousResponseId && childPrompt.parent_row_id;
        console.log('Skipping file/confluence context load - using previous_response_id for context', 
          isInheritedContext ? '(inherited from parent)' : '');
        emitter.emit({ 
          type: 'progress', 
          stage: 'context_ready', 
          files_count: 0,
          pages_count: 0,
          cached: true,
          inherited_context: isInheritedContext,
          elapsed_ms: Date.now() - startTime 
        });
      }

      // Fetch user-defined variables from q_prompt_variables
      const { data: promptVariables } = await supabase
        .from(TABLES.PROMPT_VARIABLES)
        .select('variable_name, variable_value, default_value')
        .eq('prompt_row_id', child_prompt_row_id);

      console.log(`Fetched ${promptVariables?.length || 0} user variables for prompt`);

      // Build user variables map from q_prompt_variables
      const userVariablesMap: Record<string, string> = (promptVariables || []).reduce((acc, v) => {
        if (v.variable_name) {
          acc[v.variable_name] = v.variable_value || v.default_value || '';
        }
        return acc;
      }, {} as Record<string, string>);

      // Extract stored system variables from prompt's system_variables JSONB field
      const storedSystemVariables: Record<string, string> = {};
      if (childPrompt.system_variables && typeof childPrompt.system_variables === 'object') {
        Object.entries(childPrompt.system_variables).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            storedSystemVariables[key] = String(value);
          }
        });
        console.log(`Found ${Object.keys(storedSystemVariables).length} stored system variables:`, Object.keys(storedSystemVariables));
      }

      // Build template variables from prompt fields + user variables + system variables
      const variables: Record<string, string> = {
        input_admin_prompt: childPrompt.input_admin_prompt || '',
        input_user_prompt: childPrompt.input_user_prompt || '',
        admin_prompt_result: childPrompt.admin_prompt_result || '',
        user_prompt_result: childPrompt.user_prompt_result || '',
        output_response: childPrompt.output_response || '',
        ...storedSystemVariables,
        ...userVariablesMap,
        ...template_variables,
      };

      // ============================================================================
      // RESOLVE q.ref[UUID].field REFERENCES
      // ============================================================================
      const REF_PATTERN = /\{\{q\.ref\[([a-f0-9-]{36})\]\.([a-z_]+)\}\}/gi;
      
      const extractReferencedIds = (texts: string[]): string[] => {
        const ids = new Set<string>();
        const combined = texts.join(' ');
        let match;
        while ((match = REF_PATTERN.exec(combined)) !== null) {
          ids.add(match[1].toLowerCase());
        }
        REF_PATTERN.lastIndex = 0;
        return Array.from(ids);
      };

      const textsToScan = [
        childPrompt.input_admin_prompt || '',
        childPrompt.input_user_prompt || '',
        user_message || '',
        assistantData.instructions || ''
      ];
      
      const referencedIds = extractReferencedIds(textsToScan);
      
      if (referencedIds.length > 0) {
        console.log(`Found ${referencedIds.length} q.ref references to resolve:`, referencedIds);
        
        const { data: refPrompts } = await supabase
          .from(TABLES.PROMPTS)
          .select('row_id, prompt_name, output_response, user_prompt_result, input_admin_prompt, input_user_prompt, system_variables')
          .in('row_id', referencedIds);
        
        if (refPrompts && refPrompts.length > 0) {
          refPrompts.forEach((p: any) => {
            variables[`q.ref[${p.row_id}].output_response`] = p.output_response || '';
            variables[`q.ref[${p.row_id}].user_prompt_result`] = p.user_prompt_result || '';
            variables[`q.ref[${p.row_id}].input_admin_prompt`] = p.input_admin_prompt || '';
            variables[`q.ref[${p.row_id}].input_user_prompt`] = p.input_user_prompt || '';
            variables[`q.ref[${p.row_id}].prompt_name`] = p.prompt_name || '';
            
            if (p.system_variables && typeof p.system_variables === 'object') {
              Object.entries(p.system_variables).forEach(([key, val]) => {
                variables[`q.ref[${p.row_id}].${key}`] = String(val ?? '');
              });
            }
          });
          console.log(`Resolved ${refPrompts.length} referenced prompts`);
        }
      }

      // Fetch empty prompt fallback setting
      let emptyPromptFallback = 'Execute this prompt';
      try {
        const { data: fallbackSetting } = await supabase
          .from(TABLES.SETTINGS)
          .select('setting_value')
          .eq('setting_key', 'cascade_empty_prompt_fallback')
          .single();
        
        if (fallbackSetting?.setting_value) {
          emptyPromptFallback = fallbackSetting.setting_value;
        }
      } catch (err) {
        console.log('Using default empty prompt fallback');
      }

      // Apply template to user message
      let finalMessage = user_message 
        ? applyTemplate(user_message, variables)
        : applyTemplate(childPrompt.input_user_prompt || childPrompt.input_admin_prompt || emptyPromptFallback, variables);

      console.log('Applied template variables:', Object.keys(variables).filter(k => k.startsWith('q.')));

      // Prepend file context if available (only on first message)
      if (fileContext) {
        finalMessage = fileContext + finalMessage;
      }

      // Prepend Confluence context if available (only on first message)
      if (confluenceContext) {
        finalMessage = confluenceContext + finalMessage;
      }

      if (!finalMessage.trim()) {
        console.error('No message to send for prompt:', {
          child_prompt_row_id,
          prompt_name: childPrompt.prompt_name,
        });
        emitter.emit({ 
          type: 'error', 
          error: `No message to send for prompt "${childPrompt.prompt_name}". Add content to the user prompt or admin prompt field.`,
          error_code: 'NO_MESSAGE_CONTENT',
          prompt_name: childPrompt.prompt_name,
        });
        return;
      }

      // Build system prompt from assistant instructions + admin prompt
      let systemPrompt = assistantData.instructions 
        ? applyTemplate(assistantData.instructions, variables)
        : '';
      
      const adminPrompt = childPrompt.input_admin_prompt 
        ? applyTemplate(childPrompt.input_admin_prompt, variables)
        : '';
      
      if (adminPrompt && adminPrompt.trim()) {
        systemPrompt = systemPrompt 
          ? `${systemPrompt}\n\n${adminPrompt.trim()}`
          : adminPrompt.trim();
      }

      // Build API options from prompt settings
      const apiOptions: {
        responseFormat?: any;
        seed?: number;
        toolChoice?: string;
        reasoningEffort?: string;
      } = {};

      // Handle action nodes - prepend action system prompt and set structured output
      if (childPrompt.node_type === 'action') {
        if (childPrompt.response_format) {
          try {
            const format = typeof childPrompt.response_format === 'string' 
              ? JSON.parse(childPrompt.response_format) 
              : childPrompt.response_format;
            
            if (format.type === 'json_schema') {
              apiOptions.responseFormat = format;
              
              const schemaDesc = formatSchemaForPrompt(format.json_schema?.schema);
              
              let actionSystemPrompt = DEFAULT_ACTION_SYSTEM_PROMPT;
              try {
                const { data: customPrompt } = await supabase
                  .from(TABLES.SETTINGS)
                  .select('setting_value')
                  .eq('setting_key', 'default_action_system_prompt')
                  .single();
                
                if (customPrompt?.setting_value) {
                  actionSystemPrompt = customPrompt.setting_value;
                }
              } catch {
                console.log('Using default action system prompt');
              }
              
              actionSystemPrompt = actionSystemPrompt.replace('{{schema_description}}', schemaDesc);
              
              systemPrompt = systemPrompt
                ? `${actionSystemPrompt}\n\n---\n\n${systemPrompt}`
                : actionSystemPrompt;
              
              console.log('Action node: applied structured output format');
            }
          } catch (err) {
            console.warn('Could not parse response_format:', err);
          }
        }
      }

      // Add seed if enabled
      if (childPrompt.seed_on && childPrompt.seed) {
        const seed = parseInt(childPrompt.seed, 10);
        if (!isNaN(seed)) {
          apiOptions.seed = seed;
        }
      }

      // Add reasoning effort for o1/o3 models
      if (childPrompt.reasoning_effort_on && childPrompt.reasoning_effort) {
        apiOptions.reasoningEffort = childPrompt.reasoning_effort;
      }

      // Get model for display
      const defaultModel = await getDefaultModelFromSettings(supabase);
      const modelUsedForMetadata = assistantData.model_override || defaultModel;

      // Emit calling_api progress
      emitter.emit({ 
        type: 'progress', 
        stage: 'calling_api', 
        model: modelUsedForMetadata,
        prompt_name: childPrompt.prompt_name,
        elapsed_ms: Date.now() - startTime 
      });

      // Call OpenAI Responses API
      const result = await runResponsesAPI(
        assistantData,
        finalMessage,
        systemPrompt,
        previousResponseId,
        OPENAI_API_KEY,
        supabase,
        apiOptions
      );

      if (!result.success) {
        const errorText = result.error || 'Responses API call failed';

        console.error('Responses API failed:', {
          child_prompt_row_id,
          prompt_name: childPrompt.prompt_name,
          error: errorText,
          error_code: result.error_code,
        });

        let retryAfterS: number | null = null;
        if (result.error_code === 'RATE_LIMITED' || /rate limit/i.test(errorText)) {
          const match = /try again in ([0-9.]+)s/i.exec(errorText);
          if (match) {
            const parsed = Number.parseFloat(match[1]);
            if (!Number.isNaN(parsed) && parsed > 0) retryAfterS = parsed;
          }
        }

        emitter.emit({
          type: 'error',
          error: errorText,
          error_code: result.error_code,
          prompt_name: childPrompt.prompt_name,
          ...(retryAfterS ? { retry_after_s: retryAfterS } : {}),
        });
        return;
      }

      // Update child prompt with response
      await supabase
        .from(TABLES.PROMPTS)
        .update({ 
          output_response: result.response,
          last_ai_call_metadata: {
            latency_ms: Date.now() - startTime,
            model: modelUsedForMetadata,
            tokens_input: result.usage?.prompt_tokens || 0,
            tokens_output: result.usage?.completion_tokens || 0,
            tokens_total: result.usage?.total_tokens || 0,
            response_id: result.response_id,
          }
        })
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

      console.log('Run completed successfully');

      // Emit complete event with full response data
      emitter.emit({
        type: 'complete',
        success: true,
        response: result.response,
        usage: result.usage,
        model: modelUsedForMetadata,
        child_prompt_name: childPrompt.prompt_name,
        thread_row_id: activeThreadRowId,
        response_id: result.response_id,
        elapsed_ms: Date.now() - startTime,
      });

    } catch (error) {
      console.error('Conversation run error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      emitter.emit({ type: 'error', error: message, error_code: 'INTERNAL_ERROR' });
    } finally {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      emitter.close();
    }
  })();

  // Return SSE stream immediately
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
