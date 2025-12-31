import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { fetchModelConfig, resolveApiModelId, fetchActiveModels, getDefaultModelFromSettings, getTokenParam } from "../_shared/models.ts";
import { resolveRootPromptId, getOrCreateFamilyThread, updateFamilyThreadResponse } from "../_shared/familyThreads.ts";

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

// Ensure schema is compliant with OpenAI's strict mode requirements
// All objects must have additionalProperties: false and all properties in required array
function ensureStrictCompliance(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  
  const fixed = { ...schema };
  
  if (fixed.type === 'object' && fixed.properties) {
    // Add additionalProperties: false for strict mode
    fixed.additionalProperties = false;
    
    // Ensure all properties are required
    fixed.required = Object.keys(fixed.properties);
    
    // Recursively fix nested objects/arrays
    fixed.properties = Object.fromEntries(
      Object.entries(fixed.properties).map(([key, value]) => [
        key,
        ensureStrictCompliance(value)
      ])
    );
  }
  
  if (fixed.type === 'array' && fixed.items) {
    fixed.items = ensureStrictCompliance(fixed.items);
  }
  
  return fixed;
}

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

// API options interface for runResponsesAPI
interface ApiOptions {
  responseFormat?: any;
  seed?: number;
  toolChoice?: string;
  reasoningEffort?: string;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topP?: number;
  temperature?: number;
  maxTokens?: number;
}

// Call OpenAI Responses API - uses previous_response_id for multi-turn context
async function runResponsesAPI(
  assistantData: any,
  userMessage: string,
  systemPrompt: string,
  previousResponseId: string | null,
  apiKey: string,
  supabase: any,
  options: ApiOptions = {},
): Promise<ResponsesResult & { requestParams?: any }> {
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
    // Apply strict mode compliance to ensure schema meets OpenAI requirements
    const originalSchema = options.responseFormat.json_schema?.schema;
    const compliantSchema = ensureStrictCompliance(originalSchema);
    
    if (JSON.stringify(originalSchema) !== JSON.stringify(compliantSchema)) {
      console.log('Schema auto-fixed for strict mode compliance');
    }
    
    requestBody.text = {
      format: {
        type: 'json_schema',
        name: options.responseFormat.json_schema?.name || 'response',
        schema: compliantSchema,
        strict: true, // Always use strict mode
      },
    };
    console.log('Using structured output format:', requestBody.text.format.name);
  }

  // Add model parameters - prefer options (from prompt settings) over assistant overrides
  const temperature = options.temperature ?? (assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined);
  const topP = options.topP ?? (assistantData.top_p_override ? parseFloat(assistantData.top_p_override) : undefined);
  const maxTokens = options.maxTokens ?? (assistantData.max_tokens_override ? parseInt(assistantData.max_tokens_override, 10) : undefined);

  if (modelSupportsTemp && temperature !== undefined && !isNaN(temperature)) {
    requestBody.temperature = temperature;
  }
  if (modelSupportsTemp && topP !== undefined && !isNaN(topP)) {
    requestBody.top_p = topP;
  }
  // Use model's token_param to determine correct API parameter name
  if (maxTokens !== undefined && !isNaN(maxTokens)) {
    const tokenParam = await getTokenParam(supabase, requestedModel);
    // OpenAI Responses API uses max_output_tokens, but we track which param type was used
    requestBody.max_output_tokens = maxTokens;
    console.log(`Using token param: ${tokenParam} -> max_output_tokens = ${maxTokens}`);
  }

  // Add frequency and presence penalty if provided
  if (options.frequencyPenalty !== undefined && !isNaN(options.frequencyPenalty)) {
    requestBody.frequency_penalty = options.frequencyPenalty;
  }
  if (options.presencePenalty !== undefined && !isNaN(options.presencePenalty)) {
    requestBody.presence_penalty = options.presencePenalty;
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

  // Build request params summary for notifications
  const modelTokenParam = await getTokenParam(supabase, requestedModel);
  const requestParams = {
    model: modelId,
    model_token_param: modelTokenParam,
    temperature: requestBody.temperature,
    top_p: requestBody.top_p,
    max_output_tokens: requestBody.max_output_tokens,
    frequency_penalty: requestBody.frequency_penalty,
    presence_penalty: requestBody.presence_penalty,
    seed: requestBody.seed,
    reasoning_effort: requestBody.reasoning?.effort,
    response_format: options.responseFormat ? {
      type: options.responseFormat.type,
      schema_name: options.responseFormat.json_schema?.name,
    } : undefined,
    has_previous_response: !!previousResponseId,
    has_instructions: !!systemPrompt,
  };

  console.log('Calling Responses API:', { 
    model: modelId, 
    hasPreviousResponse: !!previousResponseId,
    hasInstructions: !!systemPrompt,
    hasStructuredOutput: !!options.responseFormat,
    requestParams,
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
    requestParams,
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

      // ============================================================================
      // UNIFIED FAMILY THREAD RESOLUTION
      // All prompts in a family share ONE thread, keyed by root_prompt_row_id
      // ============================================================================
      
      // Resolve the root prompt ID (walk up parent chain to find top-level)
      const rootPromptRowId = await resolveRootPromptId(supabase, child_prompt_row_id);
      console.log('Resolved root prompt:', rootPromptRowId, 'from child:', child_prompt_row_id);

      // Get or create the unified family thread
      const familyThread = await getOrCreateFamilyThread(
        supabase, 
        rootPromptRowId, 
        validation.user!.id,
        childPrompt.prompt_name
      );

      const activeThreadRowId = familyThread.row_id;
      const previousResponseId = familyThread.last_response_id;
      
      // If thread existed and has no previous response, context is "new" not inherited
      // If thread existed and has previous response, context is inherited from family conversation
      const isInheritedFromParent = !familyThread.created && !!previousResponseId;

      console.log('Unified thread resolution:', {
        root_prompt_row_id: rootPromptRowId,
        child_prompt_row_id: child_prompt_row_id,
        thread_row_id: activeThreadRowId,
        previous_response_id: previousResponseId,
        thread_created: familyThread.created,
        inherited_context: isInheritedFromParent,
      });

      // ============================================================================
      // OPTIMIZATION: Skip file/confluence loading only for TRUE follow-ups
      // (same thread continuation). When context is INHERITED from parent,
      // we still need to load files/pages as they're not in the OpenAI context.
      // ============================================================================
      const isFollowUpMessage = !!previousResponseId && !isInheritedFromParent;
      let fileContext = '';
      let confluenceContext = '';
      let filesCount = 0;
      let pagesCount = 0;

      if (!isFollowUpMessage) {
        emitter.emit({ 
          type: 'progress', 
          stage: 'loading_context', 
          message: 'Loading files and pages...',
          inherited_context: isInheritedFromParent,
          elapsed_ms: Date.now() - startTime 
        });

// Fetch attached Confluence pages for context injection
        // ALWAYS include pages from parent prompts in hierarchy (not just when isInheritedFromParent)
        // Collect all prompt IDs in the hierarchy for confluence page lookup
        const allPromptIdsForContext = [child_prompt_row_id];
        let walkPromptId = childPrompt.parent_row_id;
        let walkDepth = 0;
        while (walkPromptId && walkDepth < 10) {
          allPromptIdsForContext.push(walkPromptId);
          const { data: walkPrompt } = await supabase
            .from(TABLES.PROMPTS)
            .select('parent_row_id')
            .eq('row_id', walkPromptId)
            .single();
          walkPromptId = walkPrompt?.parent_row_id || null;
          walkDepth++;
        }
        
        console.log('Fetching confluence pages for prompt hierarchy:', allPromptIdsForContext);
        
        // Build confluence query to include pages from all prompts AND assistants in hierarchy
        let confluenceQuery = supabase
          .from(TABLES.CONFLUENCE_PAGES)
          .select('page_id, page_title, content_text, page_url, prompt_row_id');
        
        if (allAssistantRowIds.length > 0) {
          // Include pages attached to any assistant OR any prompt in the hierarchy
          confluenceQuery = confluenceQuery.or(
            `assistant_row_id.in.(${allAssistantRowIds.join(',')}),prompt_row_id.in.(${allPromptIdsForContext.join(',')})`
          );
        } else {
          // No assistants, just check prompts in hierarchy
          confluenceQuery = confluenceQuery.in('prompt_row_id', allPromptIdsForContext);
        }
        
        const { data: confluencePages } = await confluenceQuery;
        console.log(`Found ${confluencePages?.length || 0} confluence pages from hierarchy`);

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
          inherited_context: isInheritedFromParent,
          elapsed_ms: Date.now() - startTime 
        });
      } else {
        console.log('Skipping file/confluence context load - true follow-up message in same thread');
        emitter.emit({ 
          type: 'progress', 
          stage: 'context_ready', 
          files_count: 0,
          pages_count: 0,
          cached: true,
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

// ============================================================================
      // RESOLVE SYSTEM VARIABLES (q.* prefix)
      // Static variables are computed at runtime, stored variables come from DB
      // ============================================================================
      
      // Resolve static system variables at runtime
      const staticSystemVariables: Record<string, string> = {
        // Date/Time variables
        'q.today': new Date().toISOString().split('T')[0],
        'q.now': new Date().toISOString(),
        'q.year': new Date().getFullYear().toString(),
        'q.month': new Date().toLocaleString('en-US', { month: 'long' }),
        // User variables
        'q.user.name': validation.user?.user_metadata?.display_name || validation.user?.email?.split('@')[0] || 'Unknown',
        'q.user.email': validation.user?.email || '',
      };
      
      // Fetch parent prompt name for q.parent.prompt.name and top-level prompt name
      let parentPromptName = '';
      let topLevelPromptName = childPrompt.prompt_name || '';
      
      if (childPrompt.parent_row_id) {
        const { data: parentPrompt } = await supabase
          .from(TABLES.PROMPTS)
          .select('prompt_name, parent_row_id')
          .eq('row_id', childPrompt.parent_row_id)
          .single();
        
        if (parentPrompt) {
          parentPromptName = parentPrompt.prompt_name || '';
          topLevelPromptName = parentPromptName; // Start with immediate parent
          
          // Walk up to find the true top-level prompt
          let currentParentId = parentPrompt.parent_row_id;
          let depth = 0;
          while (currentParentId && depth < 10) {
            const { data: ancestorPrompt } = await supabase
              .from(TABLES.PROMPTS)
              .select('prompt_name, parent_row_id')
              .eq('row_id', currentParentId)
              .single();
            
            if (ancestorPrompt) {
              topLevelPromptName = ancestorPrompt.prompt_name || topLevelPromptName;
              currentParentId = ancestorPrompt.parent_row_id;
            } else {
              break;
            }
            depth++;
          }
        }
      }
      
      // Add prompt context variables
      staticSystemVariables['q.toplevel.prompt.name'] = topLevelPromptName;
      staticSystemVariables['q.parent.prompt.name'] = parentPromptName;
      staticSystemVariables['q.prompt.name'] = childPrompt.prompt_name || '';
      staticSystemVariables['q.prompt.id'] = child_prompt_row_id;
      
      console.log('Resolved static system variables:', Object.keys(staticSystemVariables));
      
      // Extract stored system variables from prompt's system_variables JSONB field
      // These are user-input variables like q.policy.name set by the user
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
      // Order matters: later entries override earlier ones
      const variables: Record<string, string> = {
        input_admin_prompt: childPrompt.input_admin_prompt || '',
        input_user_prompt: childPrompt.input_user_prompt || '',
        admin_prompt_result: childPrompt.admin_prompt_result || '',
        user_prompt_result: childPrompt.user_prompt_result || '',
        output_response: childPrompt.output_response || '',
        ...staticSystemVariables,    // Static q.* variables (computed at runtime)
        ...storedSystemVariables,    // User-input q.* variables (from system_variables field)
        ...userVariablesMap,         // User-defined variables (from q_prompt_variables table)
        ...template_variables,       // Variables passed in the request
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
      const apiOptions: ApiOptions = {};

      // Add prompt-level model settings if enabled
      if (childPrompt.temperature_on && childPrompt.temperature) {
        const temp = parseFloat(childPrompt.temperature);
        if (!isNaN(temp)) apiOptions.temperature = temp;
      }
      if (childPrompt.top_p_on && childPrompt.top_p) {
        const topP = parseFloat(childPrompt.top_p);
        if (!isNaN(topP)) apiOptions.topP = topP;
      }
      // Handle max tokens - check both max_tokens and max_completion_tokens based on what's enabled
      if (childPrompt.max_tokens_on && childPrompt.max_tokens) {
        const maxT = parseInt(childPrompt.max_tokens, 10);
        if (!isNaN(maxT)) apiOptions.maxTokens = maxT;
      } else if (childPrompt.max_completion_tokens) {
        // max_completion_tokens doesn't have a separate _on toggle - if it's set, use it
        const maxT = parseInt(childPrompt.max_completion_tokens, 10);
        if (!isNaN(maxT)) apiOptions.maxTokens = maxT;
      }
      if (childPrompt.frequency_penalty_on && childPrompt.frequency_penalty) {
        const fp = parseFloat(childPrompt.frequency_penalty);
        if (!isNaN(fp)) apiOptions.frequencyPenalty = fp;
      }
      if (childPrompt.presence_penalty_on && childPrompt.presence_penalty) {
        const pp = parseFloat(childPrompt.presence_penalty);
        if (!isNaN(pp)) apiOptions.presencePenalty = pp;
      }
      if (childPrompt.tool_choice_on && childPrompt.tool_choice) {
        apiOptions.toolChoice = childPrompt.tool_choice;
      }

      // Handle action nodes - prepend action system prompt and set structured output
      if (childPrompt.node_type === 'action') {
        let schemaToUse: any = null;
        let schemaName = 'action_response';
        
        // Priority 1: Fetch schema from json_schema_template_id if set
        if (childPrompt.json_schema_template_id) {
          try {
            const { data: schemaTemplate } = await supabase
              .from(TABLES.JSON_SCHEMA_TEMPLATES)
              .select('json_schema, schema_name')
              .eq('row_id', childPrompt.json_schema_template_id)
              .single();
            
            if (schemaTemplate?.json_schema) {
              schemaToUse = typeof schemaTemplate.json_schema === 'string'
                ? JSON.parse(schemaTemplate.json_schema)
                : schemaTemplate.json_schema;
              schemaName = schemaTemplate.schema_name?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'action_response';
              console.log('Action node: using schema from template:', childPrompt.json_schema_template_id);
            }
          } catch (err) {
            console.warn('Could not fetch json_schema_template:', err);
          }
        }
        
        // Priority 2: Fallback to response_format if no template
        if (!schemaToUse && childPrompt.response_format) {
          try {
            const format = typeof childPrompt.response_format === 'string' 
              ? JSON.parse(childPrompt.response_format) 
              : childPrompt.response_format;
            
            if (format.type === 'json_schema' && format.json_schema?.schema) {
              schemaToUse = format.json_schema.schema;
              schemaName = format.json_schema?.name || 'action_response';
              console.log('Action node: using schema from response_format');
            }
          } catch (err) {
            console.warn('Could not parse response_format:', err);
          }
        }
        
        // Apply structured output if we have a schema
        if (schemaToUse) {
          // Build the proper response_format for OpenAI
          apiOptions.responseFormat = {
            type: 'json_schema',
            json_schema: {
              name: schemaName,
              strict: true,
              schema: schemaToUse,
            },
          };
          
          const schemaDesc = formatSchemaForPrompt(schemaToUse);
          
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
          
          console.log('Action node: applied structured output format with schema:', schemaName);
        } else {
          console.log('Action node: no schema found, using text response');
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

      // Update family thread with new response_id for conversation chaining
      if (activeThreadRowId && result.response_id) {
        await updateFamilyThreadResponse(supabase, activeThreadRowId, result.response_id);
      }

      console.log('Run completed successfully');

      // Emit complete event with full response data including API request params
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
        request_params: result.requestParams,
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
