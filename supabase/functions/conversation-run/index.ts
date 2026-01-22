import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { fetchModelConfig, resolveApiModelId, fetchActiveModels, getDefaultModelFromSettings, getTokenParam } from "../_shared/models.ts";
import { resolveRootPromptId, getOrCreateFamilyThread, updateFamilyThreadResponseId } from "../_shared/familyThreads.ts";
import { getBuiltinTools } from "../_shared/tools.ts";
import { ERROR_CODES } from "../_shared/errorCodes.ts";
import { variablesModule } from "../_shared/tools/variables.ts";
import type { ToolContext } from "../_shared/tools/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; error_code?: string; user?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header', error_code: ERROR_CODES.AUTH_MISSING };
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { valid: false, error: 'Server configuration error', error_code: ERROR_CODES.CONFIG_ERROR };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token', error_code: ERROR_CODES.AUTH_INVALID };
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
// Multi-turn conversations use OpenAI Conversations API (conversation parameter)
// ============================================================================

interface ResponsesResult {
  success: boolean;
  response?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
  error_code?: string;
  response_id?: string;
  requestParams?: any;
  incomplete_reason?: string;
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
  model?: string;  // Prompt-level model override
  responseFormat?: any;
  seed?: number;
  toolChoice?: string;
  reasoningEffort?: string;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topP?: number;
  temperature?: number;
  // CRITICAL: Responses API uses max_output_tokens for ALL models
  // This is different from Chat Completions API which uses max_tokens (GPT-4) / max_completion_tokens (GPT-5)
  maxOutputTokens?: number;
  // Tool options
  fileSearchEnabled?: boolean;
  codeInterpreterEnabled?: boolean;
  webSearchEnabled?: boolean;
  vectorStoreIds?: string[];
  storeInHistory?: boolean;
  // Thread context for error recovery
  threadRowId?: string;
}

// Call OpenAI Responses API - uses previous_response_id for multi-turn context
// Falls back to conversation parameter only for legacy threads without response_id
// Supports background mode for cancellation support
async function runResponsesAPI(
  assistantData: any,
  userMessage: string,
  systemPrompt: string,
  conversationId: string | null,
  lastResponseId: string | null,
  apiKey: string,
  supabase: any,
  options: ApiOptions = {},
  emitter?: SSEEmitter,
): Promise<ResponsesResult & { requestParams?: any }> {
  // Use DB for model resolution
  // Priority: 1) options.model (prompt-level), 2) assistant override, 3) default
  const defaultModel = await getDefaultModelFromSettings(supabase);
  const requestedModel = options.model || assistantData.model_override || defaultModel;
  const modelId = await resolveModelFromDb(supabase, requestedModel);
  
  // Fetch model config ONCE for all parameter decisions
  const modelConfig = await fetchModelConfig(supabase, requestedModel);
  
  // MANUS PROVIDER CHECK - Manus models are async/webhook-based and incompatible with runResponsesAPI
  if (modelConfig?.provider === 'manus') {
    console.log('Manus model detected in runResponsesAPI - rejecting:', requestedModel);
    return {
      success: false,
      error: `Model '${modelConfig.modelName}' uses the Manus provider which requires async execution via cascade. Use cascade execution instead, or select a different model.`,
      error_code: 'MANUS_NOT_SUPPORTED',
    };
  }
  
  const modelSupportsTemp = modelConfig?.supportsTemperature ?? true;
  const modelTokenParam = modelConfig?.tokenParam ?? 'max_tokens';
  const supportedSettings = modelConfig?.supportedSettings || [];
  
  console.log('Model resolution:', { optionsModel: options.model, assistantOverride: assistantData.model_override, default: defaultModel, resolved: requestedModel, tokenParam: modelTokenParam });
  
  // Build request body for Responses API
  const requestBody: any = {
    model: modelId,
    input: userMessage,
    store: options.storeInHistory !== false, // Store for conversation chaining (default true)
    background: true, // Enable background mode for cancellation support
  };

  // Add multi-turn context using previous_response_id only
  // DO NOT use conversation parameter - causes "reasoning item" errors with gpt-5/o-series models
  // If no previous_response_id exists, start fresh (first message in thread)
  if (lastResponseId?.startsWith('resp_')) {
    requestBody.previous_response_id = lastResponseId;
    console.log('Using previous_response_id for multi-turn context:', lastResponseId);
  } else {
    console.log('No previous_response_id - starting fresh conversation turn');
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
  
  // RESPONSES API: Always uses max_output_tokens for ALL models
  // Priority: options.maxOutputTokens (from prompt) > assistant.max_output_tokens_override
  const maxOutputTokens = options.maxOutputTokens ?? 
    (assistantData.max_output_tokens_override ? parseInt(assistantData.max_output_tokens_override, 10) : undefined);

  if (modelSupportsTemp && temperature !== undefined && !isNaN(temperature)) {
    requestBody.temperature = temperature;
  }
  if (modelSupportsTemp && topP !== undefined && !isNaN(topP)) {
    requestBody.top_p = topP;
  }
  
  // Responses API: Always use max_output_tokens (not max_tokens or max_completion_tokens)
  if (maxOutputTokens !== undefined && !isNaN(maxOutputTokens)) {
    requestBody.max_output_tokens = maxOutputTokens;
    console.log(`Using max_output_tokens = ${maxOutputTokens} (Responses API)`);
  }

  // Add frequency and presence penalty only if model supports them
  // Note: OpenAI Responses API for o-series/gpt-5 models does NOT support these
  if (options.frequencyPenalty !== undefined && !isNaN(options.frequencyPenalty)) {
    if (supportedSettings.includes('frequency_penalty')) {
      requestBody.frequency_penalty = options.frequencyPenalty;
    } else {
      console.log(`Skipping frequency_penalty - not supported by model ${requestedModel}`);
    }
  }
  if (options.presencePenalty !== undefined && !isNaN(options.presencePenalty)) {
    if (supportedSettings.includes('presence_penalty')) {
      requestBody.presence_penalty = options.presencePenalty;
    } else {
      console.log(`Skipping presence_penalty - not supported by model ${requestedModel}`);
    }
  }

  // Add seed if provided and supported
  if (options.seed !== undefined && !isNaN(options.seed)) {
    if (supportedSettings.includes('seed')) {
      requestBody.seed = options.seed;
    } else {
      console.log(`Skipping seed - not supported by model ${requestedModel}`);
    }
  }

  // Add reasoning effort if model supports it (get valid levels from DB)
  // Auto-enable reasoning for capable models if not explicitly set
  const validLevels = modelConfig?.reasoningEffortLevels || [];
  let reasoningEffortToUse = options.reasoningEffort;
  
  if (!reasoningEffortToUse && validLevels.length > 0) {
    // Auto-enable with 'medium' for models that support reasoning
    reasoningEffortToUse = 'medium';
    console.log('Auto-enabling reasoning effort: medium (model supports reasoning)');
  }
  
  if (reasoningEffortToUse) {
    if (validLevels.length > 0 && validLevels.includes(reasoningEffortToUse)) {
      requestBody.reasoning = { 
        effort: reasoningEffortToUse,
        summary: "auto"  // Request reasoning summaries from OpenAI
      };
      console.log('Using reasoning effort:', reasoningEffortToUse, 'with summary: auto');
    } else {
      console.log(`Skipping reasoning_effort - not supported by model ${requestedModel}`);
    }
  }

  // Build and add tools array (file_search, code_interpreter, web_search)
  const tools = getBuiltinTools({
    fileSearchEnabled: options.fileSearchEnabled,
    codeInterpreterEnabled: options.codeInterpreterEnabled,
    webSearchEnabled: options.webSearchEnabled,
    vectorStoreIds: options.vectorStoreIds,
  });
  
  if (tools.length > 0) {
    requestBody.tools = tools;
    console.log('Tools added to request:', tools.map((t: any) => t.type || t.name));
    
    // Add tool_choice if specified and tools are present
    if (options.toolChoice && supportedSettings.includes('tool_choice')) {
      requestBody.tool_choice = options.toolChoice;
      console.log('Using tool_choice:', options.toolChoice);
    }
  }
  
  // Helper to truncate prompts only (100 chars for better context)
  const truncate = (str: string | undefined, len = 100) => 
    str ? (str.length > len ? str.substring(0, len) + '...' : str) : undefined;

  // Include ALL parameters sent to the API - only prompts are truncated
  const requestParams = {
    // === MODEL ===
    model: requestBody.model,
    
    // === PROMPTS (truncated for readability) ===
    instructions: truncate(requestBody.instructions),
    input: truncate(typeof requestBody.input === 'string' ? requestBody.input : JSON.stringify(requestBody.input)),
    
    // === MULTI-TURN CONTEXT ===
    previous_response_id: requestBody.previous_response_id,
    
    // === GENERATION PARAMETERS ===
    temperature: requestBody.temperature,
    top_p: requestBody.top_p,
    frequency_penalty: requestBody.frequency_penalty,
    presence_penalty: requestBody.presence_penalty,
    seed: requestBody.seed,
    
    // === TOKEN LIMITS (Responses API uses max_output_tokens) ===
    ...(requestBody.max_output_tokens !== undefined && { max_output_tokens: requestBody.max_output_tokens }),
    
    // === REASONING ===
    reasoning: requestBody.reasoning,
    
    // === STRUCTURED OUTPUT (full schema) ===
    text: requestBody.text,
    
    // === TOOLS (full array) ===
    tools: requestBody.tools,
    tool_choice: requestBody.tool_choice,
    
    // === STORAGE/BACKGROUND ===
    store: requestBody.store,
    background: requestBody.background,
  };

  console.log('Calling Responses API (background mode):', { 
    model: modelId, 
    hasConversation: !!conversationId?.startsWith('conv_'),
    hasInstructions: !!systemPrompt,
    hasStructuredOutput: !!options.responseFormat,
    requestParams,
  });

  // Step 1: Start background request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
  
  let initialResponse: Response;
  try {
    initialResponse = await fetch('https://api.openai.com/v1/responses', {
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
  }
  clearTimeout(timeoutId);

  let initialData: any;
  
  if (!initialResponse.ok) {
    const errorText = await initialResponse.text();
    console.error('Responses API error:', initialResponse.status, errorText);
    
    let errorMessage = 'Responses API call failed';
    let errorCode = '';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
      errorCode = errorJson.error?.code || '';
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    const isRateLimit = initialResponse.status === 429;
    
    // Handle stale previous_response_id - clear thread and retry fresh
    const isPreviousResponseNotFound = 
      errorCode === 'previous_response_not_found' ||
      errorMessage.toLowerCase().includes('previous response') ||
      (initialResponse.status === 400 && errorMessage.toLowerCase().includes('not found'));
    
    if (isPreviousResponseNotFound && requestBody.previous_response_id) {
      console.warn('Previous response not found, clearing thread context and retrying fresh');
      
      // Clear the thread's last_response_id if we have threadRowId
      if (options.threadRowId) {
        try {
          await supabase
            .from('q_threads')
            .update({ last_response_id: null })
            .eq('row_id', options.threadRowId);
          console.log('Cleared stale last_response_id from thread:', options.threadRowId);
        } catch (clearErr) {
          console.error('Failed to clear thread last_response_id:', clearErr);
        }
      }
      
      // Retry without previous_response_id
      delete requestBody.previous_response_id;
      
      const retryResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (retryResponse.ok) {
        // Use retry data and continue with rest of function
        initialData = await retryResponse.json();
        console.log('Retry successful after clearing previous_response_id:', initialData.id);
        
        // Emit warning that context was lost
        if (emitter) {
          emitter.emit({ 
            type: 'progress', 
            message: 'Thread context was reset due to stale conversation state',
          });
        }
      } else {
        const retryErrorText = await retryResponse.text();
        console.error('Retry also failed:', retryResponse.status, retryErrorText);
        return {
          success: false,
          error: `Retry failed after clearing context: ${retryErrorText}`,
          error_code: 'API_CALL_FAILED',
        };
      }
    } else {
      return { 
        success: false, 
        error: errorMessage,
        error_code: isRateLimit ? 'RATE_LIMITED' : 'API_CALL_FAILED',
      };
    }
  } else {
    initialData = await initialResponse.json();
  }
  
  const responseId = initialData.id;
  const initialStatus = initialData.status; // 'queued', 'in_progress', 'completed', 'failed', 'cancelled'
  
  console.log('Background request started:', { responseId, status: initialStatus });

  // Step 2: Emit api_started event with response_id for cancellation support
  if (emitter) {
    emitter.emit({ 
      type: 'api_started', 
      response_id: responseId,
      status: initialStatus,
    });
  }

  // If already completed (rare, very fast responses), extract result directly
  if (initialStatus === 'completed') {
    console.log('Response completed immediately (no polling needed)');
    let responseText = '';
    if (initialData.output && Array.isArray(initialData.output)) {
      for (const item of initialData.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              responseText += contentItem.text;
            }
          }
        }
      }
    }
    
    const usage = {
      prompt_tokens: initialData.usage?.input_tokens || 0,
      completion_tokens: initialData.usage?.output_tokens || 0,
      total_tokens: (initialData.usage?.input_tokens || 0) + (initialData.usage?.output_tokens || 0),
    };
    
    return {
      success: true,
      response: responseText,
      usage,
      response_id: responseId,
      requestParams,
    };
  }

  // Handle immediate failure or cancellation
  if (initialStatus === 'failed') {
    const errorMsg = initialData.error?.message || 'Response failed immediately';
    console.error('Response failed immediately:', errorMsg);
    return {
      success: false,
      error: errorMsg,
      error_code: 'API_CALL_FAILED',
      response_id: responseId,
    };
  }
  
  if (initialStatus === 'cancelled') {
    console.log('Response was cancelled before processing');
    return {
      success: false,
      error: 'Request was cancelled',
      error_code: 'CANCELLED',
      response_id: responseId,
    };
  }

  // Step 3: Stream the response using GET /v1/responses/{id}?stream=true
  console.log('Starting response stream for:', responseId);
  
  // Rolling idle timeout - resets every time data is received
  // Reduced from 5min to 90s - fall back to polling faster to avoid edge function timeouts
  const IDLE_TIMEOUT_MS = 90000; // 90 seconds of no activity
  const streamController = new AbortController();
  let idleTimeoutId: number | null = null;
  let abortReason: 'idle' | null = null;
  
  // Track execution start time to avoid edge function hard limits
  const executionStartTime = Date.now();
  const MAX_EXECUTION_MS = 270000; // 4.5 minutes max (leave margin for cleanup)

  // Polling fallback function for when streaming stalls
  const pollForCompletion = async (): Promise<ResponsesResult> => {
    const maxWaitMs = 600000; // 10 minutes max
    const intervalMs = 3000; // Poll every 3 seconds
    const startTime = Date.now();
    let pollCount = 0;
    
    console.log('Falling back to polling for response:', responseId);
    
    while (Date.now() - startTime < maxWaitMs) {
      // Check edge function execution time limit
      if (Date.now() - executionStartTime > MAX_EXECUTION_MS) {
        console.error('Edge function execution time limit approaching');
        if (emitter) {
          emitter.emit({
            type: 'error',
            error: 'Request taking too long. Complex reasoning may require more time than allowed.',
            error_code: 'EXECUTION_TIMEOUT',
          });
        }
        return {
          success: false,
          error: 'Edge function execution time limit reached',
          error_code: 'EXECUTION_TIMEOUT',
          response_id: responseId,
          requestParams,
        };
      }
      
      try {
        pollCount++;
        const response = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        
        if (!response.ok) {
          console.error('Polling request failed:', response.status);
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        }
        
        const data = await response.json();
        const elapsed = Date.now() - startTime;
        
        // Log progress every 10 polls (~30 seconds)
        if (pollCount % 10 === 0) {
          console.log('Polling progress:', { responseId, status: data.status, pollCount, elapsedMs: elapsed });
        }
        
        if (data.status === 'completed') {
          // Log output item types for debugging reasoning issues
          const itemTypes = (data.output || []).map((item: any) => item.type);
          const hasReasoning = itemTypes.includes('reasoning');
          console.log('Polling response completed:', { 
            responseId, 
            itemCount: data.output?.length || 0, 
            itemTypes,
            hasReasoning,
            pollCount,
            elapsedMs: elapsed,
          });
          
          let responseText = '';
          if (data.output && Array.isArray(data.output)) {
            for (const item of data.output) {
              if (item.type === 'message' && item.content) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    responseText += contentItem.text;
                  }
                }
              }
              // Handle reasoning items from polled response (background mode)
              if (item.type === 'reasoning' && emitter) {
                console.log('Processing reasoning item from poll:', { 
                  itemId: item.id, 
                  summaryParts: item.summary?.length || 0,
                });
                emitter.emit({
                  type: 'thinking_started',
                  item_id: item.id,
                });
                // Extract reasoning summary from completed output
                if (item.summary && Array.isArray(item.summary)) {
                  for (const summaryPart of item.summary) {
                    if (summaryPart.text) {
                      emitter.emit({
                        type: 'thinking_delta',
                        delta: summaryPart.text,
                        item_id: item.id,
                      });
                    }
                  }
                }
              // Build full summary text for thinking_done
                const fullSummaryText = (item.summary || [])
                  .map((s: { text?: string }) => s.text || '')
                  .join('');
                emitter.emit({
                  type: 'thinking_done',
                  text: fullSummaryText,
                  item_id: item.id,
                });
              }
              // Detect built-in tool execution in polling response
              if (['file_search', 'web_search_preview', 'code_interpreter'].includes(item.type) && emitter) {
                console.log('Built-in tool in polling response:', item.type, 'results:', item.results?.length || 0);
                emitter.emit({ type: 'tool_activity', tool: item.type, status: 'completed' });
              }
            }
          }
          
          const usage = {
            prompt_tokens: data.usage?.input_tokens || 0,
            completion_tokens: data.usage?.output_tokens || 0,
            total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
          };
          
          console.log('Polling completed successfully:', { responseId, textLength: responseText.length, pollCount, elapsedMs: elapsed });
          
          // Emit final output text for dashboard (polling fallback)
          if (emitter && responseText) {
            emitter.emit({
              type: 'output_text_done',
              text: responseText,
              item_id: 'polling_fallback',
            });
          }
          
          // Emit usage for live dashboard updates (polling fallback)
          if (emitter && data.usage) {
            emitter.emit({
              type: 'usage_delta',
              input_tokens: data.usage.input_tokens || 0,
              output_tokens: data.usage.output_tokens || 0,
            });
          }
          
          return {
            success: true,
            response: responseText,
            usage,
            response_id: responseId,
            requestParams,
          };
        }
        
        if (data.status === 'failed') {
          return {
            success: false,
            error: data.error?.message || 'Response failed',
            error_code: 'API_CALL_FAILED',
            response_id: responseId,
            requestParams,
          };
        }
        
        if (data.status === 'cancelled') {
          return {
            success: false,
            error: 'Request was cancelled',
            error_code: 'CANCELLED',
            response_id: responseId,
            requestParams,
          };
        }
        
        // Handle incomplete status - return partial content
        if (data.status === 'incomplete') {
          let responseText = '';
          if (data.output && Array.isArray(data.output)) {
            for (const item of data.output) {
              if (item.type === 'message' && item.content) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    responseText += contentItem.text;
                  }
                }
              }
            }
          }
          
          const usage = {
            prompt_tokens: data.usage?.input_tokens || 0,
            completion_tokens: data.usage?.output_tokens || 0,
            total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
          };
          
          const reason = data.incomplete_details?.reason || 'unknown';
          console.warn('Response incomplete:', { responseId, reason, textLength: responseText.length });
          
          // Emit partial content
          if (emitter && responseText) {
            emitter.emit({ type: 'output_text_done', text: responseText, item_id: 'polling_incomplete' });
          }
          if (emitter && data.usage) {
            emitter.emit({ type: 'usage_delta', input_tokens: data.usage.input_tokens || 0, output_tokens: data.usage.output_tokens || 0 });
          }
          
          return {
            success: true,
            response: responseText,
            usage,
            response_id: responseId,
            requestParams,
            incomplete_reason: reason,
          };
        }
        
        // Handle requires_action status - built-in tools are auto-executed by OpenAI
        // We just need to continue polling until completion
        if (data.status === 'requires_action') {
          console.log('Response requires action (built-in tools executing):', responseId);
          // Continue polling - OpenAI handles built-in tools automatically
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        }
        
        // Still queued or in_progress, continue polling
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        
      } catch (pollError) {
        console.error('Polling error:', pollError);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    console.error('Polling timed out after 10 minutes');
    
    // Emit error event so client receives the timeout
    if (emitter) {
      emitter.emit({
        type: 'error',
        error: 'Request timed out waiting for AI response',
        error_code: 'POLL_TIMEOUT',
      });
    }
    
    return {
      success: false,
      error: 'Polling timed out after 10 minutes',
      error_code: 'POLL_TIMEOUT',
      response_id: responseId,
      requestParams,
    };
  };

  const resetIdleTimeout = () => {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(() => {
      abortReason = 'idle';
      console.error('Stream idle timeout - no data received for 90 seconds');
      streamController.abort();
    }, IDLE_TIMEOUT_MS);
  };

  // Start initial idle timeout
  resetIdleTimeout();
  
  let streamResponse: Response;
  try {
    streamResponse = await fetch(
      `https://api.openai.com/v1/responses/${responseId}?stream=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: streamController.signal,
      }
    );
  } catch (streamError: unknown) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    if (streamError instanceof Error && streamError.name === 'AbortError') {
      if (abortReason === 'idle') {
        console.warn('Stream connection stalled, falling back to polling...');
        // Fall back to polling instead of failing
        return await pollForCompletion();
      }
      console.error('Response stream timed out');
      return {
        success: false,
        error: 'Response streaming timed out',
        error_code: 'STREAM_TIMEOUT',
        response_id: responseId,
        requestParams,
      };
    }
    throw streamError;
  }

  if (!streamResponse.ok) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    const errorText = await streamResponse.text();
    console.error('Stream response error:', streamResponse.status, errorText);
    return {
      success: false,
      error: 'Failed to stream response',
      error_code: 'STREAM_FAILED',
      response_id: responseId,
    };
  }

  // Parse the SSE stream from OpenAI
  const reader = streamResponse.body?.getReader();
  if (!reader) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    return {
      success: false,
      error: 'No stream body available',
      error_code: 'STREAM_FAILED',
      response_id: responseId,
    };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: any = null;
  let accumulatedText = '';
  let finalUsage: any = null;
  
  // Progress tracking
  const streamStartTime = Date.now();
  let chunkCount = 0;
  let lastLogTime = Date.now();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Reset idle timeout on activity
      resetIdleTimeout();
      chunkCount++;
      
      const now = Date.now();
      // Log progress every 30 seconds
      if (now - lastLogTime > 30000) {
        console.log('Stream progress:', {
          responseId,
          chunkCount,
          elapsedMs: now - streamStartTime,
          accumulatedTextLength: accumulatedText.length,
        });
        lastLogTime = now;
      }
      
      // Debug: Log every 10th chunk's event types to understand what OpenAI sends
      const shouldLogEvent = chunkCount <= 5 || chunkCount % 50 === 0;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;

        const data = line.replace(/^data:\s?/, '').trim();
        if (!data || data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          
          // Debug logging for understanding OpenAI event structure
          if (shouldLogEvent) {
            console.log('OpenAI SSE event:', {
              type: event.type,
              status: event.status,
              hasOutput: !!event.output,
              outputTypes: event.output?.map((o: any) => o.type),
              hasItem: !!event.item,
              itemType: event.item?.type,
              hasDelta: !!event.delta,
              hasPart: !!event.part,
            });
          }
          
          // Track the response status
          if (event.status === 'cancelled') {
            console.log('Response was cancelled during streaming');
            if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
            reader.cancel();
            return {
              success: false,
              error: 'Request was cancelled',
              error_code: 'CANCELLED',
              response_id: responseId,
            };
          }
          
          if (event.status === 'failed') {
            const errorMsg = event.error?.message || 'Response failed during streaming';
            console.error('Response failed during streaming:', errorMsg);
            if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
            reader.cancel();
            return {
              success: false,
              error: errorMsg,
              error_code: 'API_CALL_FAILED',
              response_id: responseId,
            };
          }
          
          // Handle incomplete status during streaming - let stream finish extracting partial content
          if (event.status === 'incomplete') {
            const reason = event.incomplete_details?.reason || 'unknown';
            console.warn('Response incomplete during streaming:', { responseId, reason });
            // Don't abort - continue to extract whatever text was generated
          }
          
          // Handle requires_action status - built-in tools are auto-executed by OpenAI
          // Continue streaming - OpenAI handles built-in tools automatically
          if (event.status === 'requires_action') {
            console.log('Response requires action during streaming (built-in tools executing)');
            // Don't abort - continue streaming to capture results
          }
          
          // Capture usage when available and emit for live dashboard
          if (event.usage) {
            finalUsage = event.usage;
            if (emitter) {
              emitter.emit({
                type: 'usage_delta',
                input_tokens: event.usage.input_tokens || 0,
                output_tokens: event.usage.output_tokens || 0,
              });
            }
          }
          
          // Capture output content and emit reasoning/thinking events
          if (event.output && Array.isArray(event.output)) {
            for (const item of event.output) {
              if (item.type === 'message' && item.content) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    accumulatedText = contentItem.text; // Full text in each event
                  }
                }
              }
              // Handle reasoning/thinking content from completed output
              if (item.type === 'reasoning' && emitter) {
                console.log('Processing reasoning item from streaming output:', { 
                  itemId: item.id, 
                  summaryParts: item.summary?.length || 0,
                });
                emitter.emit({
                  type: 'thinking_started',
                  item_id: item.id,
                });
                // Extract reasoning summary if already available in completed output
                if (item.summary && Array.isArray(item.summary)) {
                  for (const summaryPart of item.summary) {
                    if (summaryPart.text) {
                      emitter.emit({
                        type: 'thinking_delta',
                        delta: summaryPart.text,
                        item_id: item.id,
                      });
                    }
                  }
                }
                // Emit thinking_done with full summary
                const fullSummaryText = (item.summary || [])
                  .map((s: { text?: string }) => s.text || '')
                  .join('');
                if (fullSummaryText) {
                  emitter.emit({
                    type: 'thinking_done',
                    text: fullSummaryText,
                    item_id: item.id,
                  });
                }
              }
              // Detect built-in tool execution in streaming response
              if (['file_search', 'web_search_preview', 'code_interpreter'].includes(item.type) && emitter) {
                console.log('Built-in tool in streaming response:', item.type, 'results:', item.results?.length || 0);
                emitter.emit({ type: 'tool_activity', tool: item.type, status: 'completed' });
              }
            }
          }
          
          // Handle streaming reasoning events from OpenAI
          // Event: response.output_item.added (new reasoning item started)
          if (event.type === 'response.output_item.added' && event.item?.type === 'reasoning' && emitter) {
            console.log('Reasoning item started:', event.item.id);
            emitter.emit({
              type: 'thinking_started',
              item_id: event.item.id,
            });
          }
          
          // Event: response.reasoning_summary_part.added (reasoning summary chunk)
          if (event.type === 'response.reasoning_summary_part.added' && emitter) {
            const partText = event.part?.text || '';
            if (partText) {
              emitter.emit({
                type: 'thinking_delta',
                delta: partText,
                item_id: event.item_id,
              });
            }
          }
          
          // Event: response.reasoning_summary_text.delta (streaming reasoning text)
          if (event.type === 'response.reasoning_summary_text.delta' && emitter) {
            emitter.emit({
              type: 'thinking_delta',
              delta: event.delta || '',
              item_id: event.item_id,
            });
          }
          
          // Event: response.reasoning_summary_text.done (reasoning complete)
          if (event.type === 'response.reasoning_summary_text.done' && emitter) {
            emitter.emit({
              type: 'thinking_done',
              text: event.text || '',
              item_id: event.item_id,
            });
          }
          
          // Event: response.output_text.delta (streaming main output text)
          if (event.type === 'response.output_text.delta' && emitter) {
            emitter.emit({
              type: 'output_text_delta',
              delta: event.delta || '',
              item_id: event.item_id,
            });
          }
          
          // Event: response.output_text.done (output text complete)
          if (event.type === 'response.output_text.done' && emitter) {
            emitter.emit({
              type: 'output_text_done',
              text: event.text || '',
              item_id: event.item_id,
            });
          }
          
          // Emit status updates for dashboard
          if (event.status && emitter && ['queued', 'in_progress', 'completed', 'failed', 'cancelled'].includes(event.status)) {
            emitter.emit({
              type: 'status_update',
              status: event.status,
            });
          }
          
          // Track final completed state
          if (event.status === 'completed') {
            finalResponse = event;
          }
        } catch (parseErr) {
          console.warn('Failed to parse stream event:', data, parseErr);
        }
      }
    }
  } catch (streamReadError: unknown) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    if (streamReadError instanceof Error && streamReadError.name === 'AbortError') {
      // Check if this was an idle timeout - fall back to polling
      if (abortReason === 'idle') {
        console.warn('Stream read stalled, falling back to polling...');
        return await pollForCompletion();
      }
      
      console.log('Stream read was aborted (possibly cancelled)');
      // Check final status via API
      try {
        const statusResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.status === 'cancelled') {
            return {
              success: false,
              error: 'Request was cancelled',
              error_code: 'CANCELLED',
              response_id: responseId,
            };
          }
        }
      } catch {
        // Ignore status check errors
      }
      return {
        success: false,
        error: 'Stream was aborted',
        error_code: 'STREAM_ABORTED',
        response_id: responseId,
      };
    }
    throw streamReadError;
  } finally {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
  }

  // Extract final response text
  let responseText = accumulatedText;
  
  // If we got a final response object, extract from there
  if (finalResponse?.output && Array.isArray(finalResponse.output)) {
    responseText = '';
    for (const item of finalResponse.output) {
      if (item.type === 'message' && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            responseText += contentItem.text;
          }
        }
      }
    }
  }

  // Build usage from final response or tracked usage
  const usageSource = finalResponse?.usage || finalUsage;
  const usage = {
    prompt_tokens: usageSource?.input_tokens || 0,
    completion_tokens: usageSource?.output_tokens || 0,
    total_tokens: (usageSource?.input_tokens || 0) + (usageSource?.output_tokens || 0),
  };

  console.log('Response streaming completed:', { responseId, textLength: responseText.length, usage });

  return {
    success: true,
    response: responseText,
    usage,
    response_id: responseId,
    requestParams,
  };
}

// ============================================================================
// QUESTION NODE EXECUTION
// Handles question nodes with ask_user_question tool loop
// Returns early with user_input_required SSE event when user input is needed
// ============================================================================

interface QuestionNodeResult {
  success: boolean;
  response?: string;
  interrupted?: boolean;
  interruptData?: {
    variableName: string;
    question: string;
    description?: string | null;
    callId: string;
    responseId: string;
  };
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  response_id?: string;
  error?: string;
}

async function runQuestionNodeAPI(params: {
  model: string;
  userMessage: string;
  systemPrompt: string;
  previousResponseId: string | null;
  resumeCallId: string | null;
  maxQuestions: number;
  questionConfig: any;
  promptRowId: string;
  userId: string;
  apiKey: string;
  supabase: any;
  emitter: any;
  threadRowId?: string;  // For stale response recovery
  // Tool configuration - same as regular prompts
  fileSearchEnabled?: boolean;
  codeInterpreterEnabled?: boolean;
  webSearchEnabled?: boolean;
  vectorStoreIds?: string[];
  // File context for system prompt injection
  fileContext?: string;
  confluenceContext?: string;
}): Promise<QuestionNodeResult> {
  const { 
    model, userMessage, systemPrompt, previousResponseId, resumeCallId, 
    maxQuestions, questionConfig, promptRowId, userId, apiKey, supabase, emitter, threadRowId,
    fileSearchEnabled, codeInterpreterEnabled, webSearchEnabled, vectorStoreIds,
    fileContext, confluenceContext
  } = params;
  
  // Build file/confluence context section for system prompt
  let contextSection = '';
  if (fileContext) {
    contextSection += `\n\n## Attached Files\n${fileContext}`;
  }
  if (confluenceContext) {
    contextSection += `\n\n## Reference Documents\n${confluenceContext}`;
  }
  
  // Build tool availability hints
  const toolHints: string[] = [];
  if (fileSearchEnabled) {
    toolHints.push('You have access to file_search to look up information from attached documents.');
  }
  if (webSearchEnabled) {
    toolHints.push('You have access to web_search_preview to search the internet for information.');
  }
  if (codeInterpreterEnabled) {
    toolHints.push('You have access to code_interpreter to run Python code for calculations or analysis.');
  }
  const toolHintsText = toolHints.length > 0 ? '\n' + toolHints.join('\n') : '';

  // Build question-specific system prompt with context
  const questionInstructions = `${systemPrompt}${contextSection}

You are gathering information from the user interactively. Use the ask_user_question tool to ask questions one at a time.
After each question, wait for the user's response. When you have all needed information, call complete_communication with a summary.
Important: Variable names for ask_user_question MUST start with ai_ prefix.${toolHintsText}`;

  // Get question tools from variables module
  const toolContext: ToolContext = {
    supabase,
    userId,
    familyContext: {
      promptRowId,
      familyPromptIds: [promptRowId],
    },
    credentials: {},
  };
  
  const allVariableTools = variablesModule.getTools(toolContext);
  const questionTools = allVariableTools.filter(t => 
    ['ask_user_question', 'store_qa_response', 'complete_communication'].includes(t.name)
  );
  
  // Build combined tools array including built-in tools (same as regular prompts)
  const tools: any[] = [...questionTools];
  
  // Add file_search if enabled and vector store available
  if (fileSearchEnabled && vectorStoreIds?.length) {
    tools.push({
      type: 'file_search',
      vector_store_ids: vectorStoreIds,
      max_num_results: 10
    });
  }
  
  // Add web_search if enabled  
  if (webSearchEnabled) {
    tools.push({
      type: 'web_search_preview'
    });
  }
  
  // Add code_interpreter if enabled
  if (codeInterpreterEnabled) {
    tools.push({
      type: 'code_interpreter',
      container: { type: 'auto' }
    });
  }
  
  console.log('Question node: using tools:', tools.map(t => t.name || t.type));
  
  // Build request body
  const requestBody: any = {
    model,
    instructions: questionInstructions,
    tools: tools,
    store: false, // Don't store in OpenAI history for run mode
    background: true,
  };
  
  // CRITICAL: When resuming from a tool call, use function_call_output format
  if (previousResponseId?.startsWith('resp_') && resumeCallId) {
    requestBody.input = [{
      type: 'function_call_output',
      call_id: resumeCallId,
      output: userMessage,  // The user's answer
    }];
    requestBody.previous_response_id = previousResponseId;
    console.log('Question node: resuming with function_call_output for call_id:', resumeCallId);
  } else {
    // Initial request - use string input
    requestBody.input = userMessage;
    if (previousResponseId?.startsWith('resp_')) {
      requestBody.previous_response_id = previousResponseId;
      console.log('Question node: continuing from response:', previousResponseId);
    }
  }
  
  // Make initial API call
  console.log('Question node: making OpenAI API call');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Question node API error:', errorText);
    
    // Parse error to check for stale previous_response_id
    let errorCode = '';
    let errorMessage = '';
    try {
      const errorJson = JSON.parse(errorText);
      errorCode = errorJson.error?.code || '';
      errorMessage = errorJson.error?.message || '';
    } catch {
      errorMessage = errorText;
    }
    
    // Handle stale previous_response_id or pending tool calls - clear thread and retry fresh
    const isPreviousResponseNotFound = 
      errorCode === 'previous_response_not_found' ||
      errorMessage.toLowerCase().includes('previous response') ||
      (response.status === 400 && errorMessage.toLowerCase().includes('not found'));
    
    // Detect stale tool call errors (from cancelled question prompts)
    const isStaleToolCall = 
      response.status === 400 && errorMessage.toLowerCase().includes('no tool output found');
    
    if ((isPreviousResponseNotFound || isStaleToolCall) && requestBody.previous_response_id) {
      console.warn('Question node: previous response not found, clearing thread context and retrying fresh');
      
      // Clear the thread's last_response_id if we have threadRowId
      if (threadRowId) {
        try {
          await supabase
            .from('q_threads')
            .update({ last_response_id: null })
            .eq('row_id', threadRowId);
          console.log('Question node: cleared stale last_response_id from thread:', threadRowId);
        } catch (clearErr) {
          console.error('Question node: failed to clear thread last_response_id:', clearErr);
        }
      }
      
      // Retry without previous_response_id
      delete requestBody.previous_response_id;
      
      const retryResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        console.error('Question node retry also failed:', retryResponse.status, retryErrorText);
        return { success: false, error: `Retry failed: ${retryErrorText}` };
      }
      
      // Use retry response and continue with normal flow
      const retryResult = await retryResponse.json();
      console.log('Question node: retry successful after clearing previous_response_id:', retryResult.id);
      
      // Emit warning that context was lost
      emitter.emit({ 
        type: 'progress', 
        message: 'Thread context was reset due to stale conversation state',
      });
      
      // Continue with retry result
      var initialResult = retryResult;
      var responseId = retryResult.id;
    } else {
      return { success: false, error: `API error: ${response.status}` };
    }
  } else {
    var initialResult = await response.json();
    var responseId = initialResult.id;
  }
  
  console.log('Question node: got response', { id: responseId, status: initialResult.status });
  
  // Emit api_started for frontend cancellation support
  emitter.emit({ type: 'api_started', response_id: responseId });
  
  // Poll for completion if background mode
  const POLL_INTERVAL = 500;
  const MAX_POLL_TIME = 300000; // 5 minutes
  const pollStartTime = Date.now();
  
  let currentResult = initialResult;
  
  while (currentResult.status === 'in_progress' || currentResult.status === 'queued') {
    if (Date.now() - pollStartTime > MAX_POLL_TIME) {
      return { success: false, error: 'Question node timeout' };
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    
    const pollResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    
    if (pollResponse.ok) {
      currentResult = await pollResponse.json();
    }
  }
  
  // Check for function calls and built-in tool calls in output
  const outputItems = currentResult.output || [];
  const functionCalls = outputItems.filter((o: any) => o.type === 'function_call');
  
  // Built-in tools return different output types (correct OpenAI types)
  const builtInToolCalls = outputItems.filter((o: any) => 
    ['file_search', 'web_search_preview', 'code_interpreter'].includes(o.type)
  );
  
  console.log('Question node: output items:', outputItems.length, 
    'function_calls:', functionCalls.length,
    'built_in_tool_calls:', builtInToolCalls.length);
  
  // Handle built-in tool calls - OpenAI processes these automatically
  // We need to check if there are results we should continue from
  if (builtInToolCalls.length > 0) {
    console.log('Question node: built-in tools executed:', builtInToolCalls.map((t: any) => t.type));
    
    // Log built-in tool results with correct type names
    for (const toolCall of builtInToolCalls) {
      if (toolCall.type === 'file_search' && toolCall.results) {
        console.log('Question node: file_search returned', toolCall.results.length, 'results');
      }
      if (toolCall.type === 'web_search_preview' && toolCall.results) {
        console.log('Question node: web_search returned', toolCall.results.length, 'results');
      }
      if (toolCall.type === 'code_interpreter') {
        console.log('Question node: code_interpreter executed');
      }
    }
  }
  
  // If no function calls (question tools), extract text response
  // This handles the case where built-in tools ran but no question tools were called
  if (functionCalls.length === 0) {
    const textOutput = outputItems.find((o: any) => o.type === 'message');
    const textContent = textOutput?.content?.find((c: any) => c.type === 'output_text');
    let responseText = textContent?.text || '';
    
    // If we got built-in tool results but no text, there might be more processing needed
    // Use a proper continuation loop instead of single poll
    if (!responseText && builtInToolCalls.length > 0) {
      console.log('Question node: built-in tools ran but no text output yet, starting continuation loop');
      
      const CONTINUATION_POLL_INTERVAL = 500;
      const MAX_CONTINUATION_TIME = 120000; // 2 minutes for continuation
      const continuationStartTime = Date.now();
      
      while (currentResult.status !== 'completed' && 
             Date.now() - continuationStartTime < MAX_CONTINUATION_TIME) {
        await new Promise(resolve => setTimeout(resolve, CONTINUATION_POLL_INTERVAL));
        
        const continuePollResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        
        if (!continuePollResponse.ok) {
          console.error('Continuation poll failed:', continuePollResponse.status);
          break;
        }
        
        currentResult = await continuePollResponse.json();
        console.log('Continuation poll status:', currentResult.status);
        
        // Check for function calls in updated output
        const updatedOutputItems = currentResult.output || [];
        const updatedFunctionCalls = updatedOutputItems.filter((o: any) => o.type === 'function_call');
        
        if (updatedFunctionCalls.length > 0) {
          // New function calls appeared - process them in the main loop
          console.log('Question node: new function calls appeared during continuation');
          // Update functionCalls for processing below
          functionCalls.push(...updatedFunctionCalls);
          break;
        }
        
        // Check for text output
        const updatedTextOutput = updatedOutputItems.find((o: any) => o.type === 'message');
        const updatedTextContent = updatedTextOutput?.content?.find((c: any) => c.type === 'output_text');
        
        if (updatedTextContent?.text) {
          responseText = updatedTextContent.text;
          console.log('Question node: got text response from continuation:', responseText.substring(0, 100));
          break;
        }
      }
      
      // If function calls were discovered during continuation, fall through to process them
      if (functionCalls.length > 0) {
        console.log('Question node: function calls found during continuation, falling through to process');
        // Fall through to function call processing loop below
      } else {
        // Only return here if still no function calls
        return {
          success: true,
          response: responseText || 'Question processing completed.',
          response_id: responseId,
          usage: currentResult.usage,
        };
      }
    } else {
      // No built-in tools ran and no function calls - return text response
      return {
        success: true,
        response: responseText,
        response_id: responseId,
        usage: currentResult.usage,
      };
    }
  }
  
  // Process function calls (question-specific tools)
  for (const functionCall of functionCalls) {
    const toolName = functionCall.name;
    const callId = functionCall.call_id;
    let args: any = {};
    
    try {
      args = JSON.parse(functionCall.arguments || '{}');
    } catch (e) {
      console.warn('Failed to parse function call arguments:', e);
    }
    
    console.log('Question node: processing tool call:', toolName, args);
    
    if (toolName === 'ask_user_question') {
      // INTERRUPT - return to frontend for user input
      let varName = args.variable_name || 'ai_response';
      if (!varName.startsWith('ai_')) {
        varName = `ai_${varName}`;
      }
      
      console.log('Question node: emitting user_input_required');
      
      // Emit the interrupt event
      emitter.emit({
        type: 'user_input_required',
        variable_name: varName,
        question: args.question,
        description: args.description || null,
        call_id: callId,
        response_id: responseId,
      });
      
      return {
        success: true,
        interrupted: true,
        interruptData: {
          variableName: varName,
          question: args.question,
          description: args.description,
          callId,
          responseId,
        },
        response_id: responseId,
      };
    }
    
    if (toolName === 'complete_communication') {
      // Information gathering complete
      const summary = args.summary || 'Information gathering complete.';
      console.log('Question node: complete_communication called');
      
      return {
        success: true,
        response: summary,
        response_id: responseId,
        usage: currentResult.usage,
      };
    }
    
    if (toolName === 'store_qa_response') {
      // Execute the storage tool via the module
      try {
        await variablesModule.handleCall('store_qa_response', args, toolContext);
        console.log('Question node: stored QA response');
      } catch (e) {
        console.warn('Failed to store QA response:', e);
      }
    }
  }
  
  // If we get here without returning, something unexpected happened
  return {
    success: true,
    response: 'Question processing completed.',
    response_id: responseId,
    usage: currentResult.usage,
  };
}

// ============================================================================
// SSE STREAMING RESPONSE HANDLER
// ============================================================================

interface SSEEmitter {
  emit: (event: any) => void;
  close: () => void;
  dispose: () => void;
}

function createSSEStream(): { stream: ReadableStream; emitter: SSEEmitter & { isClosed: () => boolean } } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let streamClosed = false;
  // Deliberate disposal flag - when true, suppress all logging for expected disconnects
  let disposed = false;
  
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel(reason) {
      // Client disconnected - mark as disposed to prevent noisy logs
      disposed = true;
      streamClosed = true;
      console.log('SSE stream cancelled by client:', reason);
    },
  });
  
  const emitter = {
    emit: (event: any) => {
      // Silent return if deliberately disposed (client disconnect, normal cleanup)
      if (disposed) return;
      
      if (streamClosed) {
        // Only warn if not disposed - unexpected emit after close
        console.warn('Attempted to emit after stream closed:', event.type);
        return;
      }
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch (e) {
        // Only log if not disposed (expected errors during disconnect)
        if (!disposed) {
          console.warn('SSE emit error:', e);
        }
        streamClosed = true;
      }
    },
    close: () => {
      if (streamClosed || disposed) {
        // Silent return if already disposed or closed
        if (!disposed) {
          console.warn('SSE stream already closed, skipping duplicate close');
        }
        return;
      }
      streamClosed = true;
      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        if (!disposed) {
          console.warn('SSE close error:', e);
        }
      }
    },
    dispose: () => {
      // Mark as intentionally disposed - suppress future logs
      disposed = true;
      streamClosed = true;
    },
    isClosed: () => streamClosed || disposed,
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

      // Start heartbeat AFTER validation succeeds (prevents resource leak on early failures)
      heartbeatInterval = setInterval(() => {
        emitter.emit({ type: 'heartbeat', elapsed_ms: Date.now() - startTime });
      }, 10000);

      console.log('User validated:', validation.user?.email);

      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!OPENAI_API_KEY) {
        emitter.emit({ type: 'error', error: 'OpenAI API key not configured', error_code: 'CONFIG_ERROR' });
        return;
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Parse and validate request body
      let requestBody: any;
      try {
        requestBody = await req.json();
      } catch (parseError) {
        emitter.emit({ type: 'error', error: 'Invalid JSON in request body', error_code: 'INVALID_REQUEST' });
        return;
      }
      
      const { 
        child_prompt_row_id, 
        user_message, 
        template_variables,
        thread_row_id,
        thread_mode,
        child_thread_strategy,
        existing_thread_row_id,
        store_in_history,
        // Resume parameters for question node answers
        resume_question_answer,
      } = requestBody;
      
      // Handle question answer resume - format user_message as answer submission
      let effectiveUserMessage = user_message;
      let resumeResponseId: string | null = null;
      let resumeCallId: string | null = null;
      
      if (resume_question_answer) {
        const { previous_response_id, answer, variable_name, call_id } = resume_question_answer;
        console.log('Resuming question with answer:', { variable_name, previous_response_id, call_id });
        
        // Store the answer for use in function_call_output format
        effectiveUserMessage = answer;
        resumeResponseId = previous_response_id;
        resumeCallId = call_id;
      }
      
      // Validate required fields
      if (!child_prompt_row_id || typeof child_prompt_row_id !== 'string') {
        emitter.emit({ type: 'error', error: 'child_prompt_row_id is required and must be a string', error_code: 'INVALID_REQUEST' });
        return;
      }
      
      // Validate UUID format for child_prompt_row_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(child_prompt_row_id)) {
        emitter.emit({ type: 'error', error: 'child_prompt_row_id must be a valid UUID', error_code: 'INVALID_REQUEST' });
        return;
      }
      
      // Validate user_message if provided (limit to 100KB to prevent abuse)
      const MAX_MESSAGE_LENGTH = 100000;
      if (user_message !== undefined && user_message !== null) {
        if (typeof user_message !== 'string') {
          emitter.emit({ type: 'error', error: 'user_message must be a string', error_code: 'INVALID_REQUEST' });
          return;
        }
        if (user_message.length > MAX_MESSAGE_LENGTH) {
          emitter.emit({ type: 'error', error: `user_message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`, error_code: 'INVALID_REQUEST' });
          return;
        }
      }
      
      // Validate template_variables if provided
      if (template_variables !== undefined && template_variables !== null) {
        if (typeof template_variables !== 'object' || Array.isArray(template_variables)) {
          emitter.emit({ type: 'error', error: 'template_variables must be an object', error_code: 'INVALID_REQUEST' });
          return;
        }
      }
      
      // Validate thread_mode if provided
      const validThreadModes = ['new', 'continue', 'none', undefined, null];
      if (!validThreadModes.includes(thread_mode)) {
        emitter.emit({ type: 'error', error: 'thread_mode must be one of: new, continue, none', error_code: 'INVALID_REQUEST' });
        return;
      }

      console.log('Conversation run request:', { 
        child_prompt_row_id, 
        user: validation.user?.email,
        thread_row_id,
        thread_mode,
      });

      // Emit started event
      emitter.emit({ type: 'started', prompt_row_id: child_prompt_row_id });

      // Fetch child prompt with parent info and verify ownership
      const { data: childPrompt, error: promptError } = await supabase
        .from(TABLES.PROMPTS)
        .select('*, parent:parent_row_id(row_id, is_assistant)')
        .eq('row_id', child_prompt_row_id)
        .maybeSingle();

      if (promptError || !childPrompt) {
        emitter.emit({ type: 'error', error: 'Prompt not found', error_code: 'NOT_FOUND' });
        return;
      }

      // Verify ownership for multi-tenant segregation
      if (childPrompt.owner_id !== validation.user?.id) {
        // Check if user is admin
        const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: validation.user?.id });
        if (!isAdmin) {
          emitter.emit({ type: 'error', error: 'Access denied - you do not own this prompt', error_code: 'ACCESS_DENIED' });
          return;
        }
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
        .maybeSingle();
      
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
          .maybeSingle();
        
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
          .maybeSingle();
        
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
          .maybeSingle();
        
        if (createAssistantError || !newAssistant) {
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

      // Get or create the unified family thread (with OpenAI Conversation)
      const familyThread = await getOrCreateFamilyThread(
        supabase, 
        rootPromptRowId, 
        validation.user!.id,
        childPrompt.prompt_name,
        OPENAI_API_KEY  // Pass API key to create real conversation
      );

      const activeThreadRowId = familyThread.row_id;
      const conversationId = familyThread.openai_conversation_id;
      
      // If thread existed and has valid conversation ID, context is inherited from family conversation
      const isInheritedFromParent = !familyThread.created && !!conversationId?.startsWith('conv_');

      console.log('Unified thread resolution:', {
        root_prompt_row_id: rootPromptRowId,
        child_prompt_row_id: child_prompt_row_id,
        thread_row_id: activeThreadRowId,
        conversation_id: conversationId,
        thread_created: familyThread.created,
        inherited_context: isInheritedFromParent,
      });

      // ============================================================================
      // OPTIMIZATION: Skip file/confluence loading only for TRUE follow-ups
      // (same thread continuation). When context is INHERITED from parent,
      // we still need to load files/pages as they're not in the OpenAI context.
      // ============================================================================
      const isFollowUpMessage = !!conversationId?.startsWith('conv_') && !isInheritedFromParent;
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
            .maybeSingle();
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
          .maybeSingle();
        
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
              .maybeSingle();
            
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
      console.log('Parent context resolved:', {
        parentPromptName,
        topLevelPromptName,
        promptName: childPrompt.prompt_name,
        hasParent: !!childPrompt.parent_row_id,
        parentRowId: childPrompt.parent_row_id || null,
      });
      
      // Extract stored system variables from prompt's system_variables JSONB field
      // These are user-editable variables like q.policy.version, q.client.name set by the user
      // IMPORTANT: Skip context variables - they should use runtime-resolved values, not stale stored snapshots
      // CONTEXT_VARIABLE_KEYS - MUST stay in sync with src/config/contextVariables.js
      // (Cannot import directly - edge functions run in isolated Deno environment)
      const CONTEXT_VARIABLE_KEYS = [
        'q.prompt.name', 'q.toplevel.prompt.name', 'q.parent.prompt.name',
        'q.parent.prompt.id', 'q.prompt.id', 'q.parent.output_response',
        'q.parent.user_prompt_result',
        'q.user.name', 'q.user.email',
        'q.today', 'q.now', 'q.year', 'q.month',
        'q.policy.name', // DEPRECATED - ignore if present
      ];
      
      const storedSystemVariables: Record<string, string> = {};
      if (childPrompt.system_variables && typeof childPrompt.system_variables === 'object') {
        Object.entries(childPrompt.system_variables).forEach(([key, value]) => {
          // Skip context variables - they must use runtime-resolved values
          if (CONTEXT_VARIABLE_KEYS.includes(key)) {
            console.log(`Skipping stored context variable ${key} - using runtime value instead`);
            return;
          }
          if (value !== undefined && value !== null && value !== '') {
            storedSystemVariables[key] = String(value);
          }
        });
        console.log(`Using ${Object.keys(storedSystemVariables).length} stored user-editable variables:`, Object.keys(storedSystemVariables));
      }

// Build template variables from prompt fields + user variables + system variables
      // Order matters: later entries override earlier ones
      // IMPORTANT: Filter protected context keys from template_variables to prevent frontend override
      const safeTemplateVariables = Object.fromEntries(
        Object.entries(template_variables || {}).filter(
          ([key]) => !CONTEXT_VARIABLE_KEYS.includes(key)
        )
      );
      
      const variables: Record<string, string> = {
        input_admin_prompt: childPrompt.input_admin_prompt || '',
        input_user_prompt: childPrompt.input_user_prompt || '',
        admin_prompt_result: childPrompt.admin_prompt_result || '',
        user_prompt_result: childPrompt.user_prompt_result || '',
        output_response: childPrompt.output_response || '',
        ...storedSystemVariables,    // User-input q.* variables (from system_variables field)
        ...userVariablesMap,         // User-defined variables (from q_prompt_variables table)
        ...safeTemplateVariables,    // Variables passed in request (protected keys filtered)
        ...staticSystemVariables,    // Static q.* variables - applied LAST for backend authority
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
        
        // CRITICAL SECURITY FIX: Enforce FAMILY BOUNDARY + owner_id + is_deleted filters
        // This prevents cross-family data leakage (the core isolation bug)
        const { data: refPrompts } = await supabase
          .from(TABLES.PROMPTS)
          .select('row_id, prompt_name, output_response, user_prompt_result, input_admin_prompt, input_user_prompt, system_variables, root_prompt_row_id')
          .in('row_id', referencedIds)
          .eq('owner_id', validation.user.id)  // Only allow access to own prompts
          .eq('is_deleted', false);            // Exclude deleted prompts
        
        // FAMILY ISOLATION: Filter results to only include prompts from SAME family
        const sameFamily = refPrompts?.filter((p: any) => 
          p.root_prompt_row_id === rootPromptRowId || p.row_id === rootPromptRowId
        ) || [];
        
        // Log any blocked access attempts for security monitoring
        const foundIds = new Set(sameFamily.map((p: any) => p.row_id));
        const blockedByOwnership = referencedIds.filter(id => 
          !refPrompts?.some((p: any) => p.row_id === id)
        );
        const blockedByFamily = refPrompts?.filter((p: any) => 
          !foundIds.has(p.row_id)
        ).map((p: any) => p.row_id) || [];
        
        if (blockedByOwnership.length > 0) {
          console.warn('SECURITY: q.ref access blocked (not owned or deleted):', blockedByOwnership);
        }
        if (blockedByFamily.length > 0) {
          console.warn('SECURITY: q.ref access blocked (CROSS-FAMILY ATTEMPT):', blockedByFamily, 
            '- Current family root:', rootPromptRowId);
        }
        
        if (sameFamily.length > 0) {
          sameFamily.forEach((p: any) => {
            variables[`q.ref[${p.row_id}].output_response`] = p.output_response || '';
            variables[`q.ref[${p.row_id}].user_prompt_result`] = p.user_prompt_result || '';
            variables[`q.ref[${p.row_id}].input_admin_prompt`] = p.input_admin_prompt || '';
            variables[`q.ref[${p.row_id}].input_user_prompt`] = p.input_user_prompt || '';
            variables[`q.ref[${p.row_id}].prompt_name`] = p.prompt_name || '';
            
            // Include system variables from referenced prompt, but skip context variables
            if (p.system_variables && typeof p.system_variables === 'object') {
              Object.entries(p.system_variables).forEach(([key, val]) => {
                // Skip context variables - they contain stale data
                if (!CONTEXT_VARIABLE_KEYS.includes(key)) {
                  variables[`q.ref[${p.row_id}].${key}`] = String(val ?? '');
                }
              });
            }
          });
          console.log(`Resolved ${sameFamily.length} referenced prompts (${blockedByOwnership.length} blocked by ownership, ${blockedByFamily.length} blocked by family)`);
        }
      }

      // Fetch empty prompt fallback setting
      let emptyPromptFallback = 'Execute this prompt';
      try {
        const { data: fallbackSetting } = await supabase
          .from(TABLES.SETTINGS)
          .select('setting_value')
          .eq('setting_key', 'cascade_empty_prompt_fallback')
          .maybeSingle();
        
        if (fallbackSetting?.setting_value) {
          emptyPromptFallback = fallbackSetting.setting_value;
        }
      } catch (err) {
        console.log('Using default empty prompt fallback');
      }

      // Apply template to user message (use effectiveUserMessage for question resume)
      let finalMessage = effectiveUserMessage 
        ? applyTemplate(effectiveUserMessage, variables)
        : applyTemplate(childPrompt.input_user_prompt || childPrompt.input_admin_prompt || emptyPromptFallback, variables);

      console.log('Applied template variables:', Object.keys(variables).filter(k => k.startsWith('q.')));

      // Prepend file context if available (only on first message)
      // NOTE: Question nodes handle context injection internally, skip here
      if (fileContext && childPrompt.node_type !== 'question') {
        finalMessage = fileContext + finalMessage;
      }

      // Prepend Confluence context if available (only on first message)
      // NOTE: Question nodes handle context injection internally, skip here
      if (confluenceContext && childPrompt.node_type !== 'question') {
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

      // Build API options from prompt settings and assistant tool config
      // First, validate vector store if file_search is enabled and vector store exists
      let validatedVectorStoreIds: string[] = [];
      const wantsFileSearch = assistantData.file_search_enabled || childPrompt.file_search_on;
      
      if (wantsFileSearch && assistantData.vector_store_id) {
        // Quick validation call to ensure vector store exists
        try {
          const vsCheckResponse = await fetch(
            `https://api.openai.com/v1/vector_stores/${assistantData.vector_store_id}`,
            {
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2',
              },
            }
          );
          
          if (vsCheckResponse.ok) {
            validatedVectorStoreIds = [assistantData.vector_store_id];
            console.log('Vector store validated:', assistantData.vector_store_id);
          } else {
            console.warn('Vector store invalid, skipping file_search. Status:', vsCheckResponse.status);
            emitter.emit({
              type: 'warning',
              message: 'File search unavailable: vector store needs repair. Re-sync files or run resource health check.',
            });
          }
        } catch (vsError) {
          console.warn('Vector store validation failed:', vsError);
          emitter.emit({
            type: 'warning',
            message: 'File search unavailable: could not validate vector store.',
          });
        }
      } else if (assistantData.vector_store_id) {
        // Vector store exists but file_search not enabled - still pass it through
        validatedVectorStoreIds = [assistantData.vector_store_id];
      }
      
      const apiOptions: ApiOptions = {
        // Tool options from assistant configuration (use validated vector store IDs)
        fileSearchEnabled: wantsFileSearch && validatedVectorStoreIds.length > 0,
        codeInterpreterEnabled: assistantData.code_interpreter_enabled || childPrompt.code_interpreter_on,
        webSearchEnabled: childPrompt.web_search_on,
        vectorStoreIds: validatedVectorStoreIds,
        storeInHistory: store_in_history !== false, // Default true for backward compatibility
        // Thread context for error recovery (clear stale response IDs on retry)
        threadRowId: activeThreadRowId,
      };
      
      console.log('Tool options:', {
        fileSearch: apiOptions.fileSearchEnabled,
        codeInterpreter: apiOptions.codeInterpreterEnabled,
        webSearch: apiOptions.webSearchEnabled,
        vectorStoreIds: apiOptions.vectorStoreIds,
        vectorStoreValidated: validatedVectorStoreIds.length > 0,
      });

      // Add prompt-level model override if enabled
      if (childPrompt.model_on && childPrompt.model) {
        apiOptions.model = childPrompt.model;
        console.log('Using prompt-level model:', childPrompt.model);
      }

      // Add prompt-level temperature if enabled
      if (childPrompt.temperature_on && childPrompt.temperature) {
        const temp = parseFloat(childPrompt.temperature);
        if (!isNaN(temp)) apiOptions.temperature = temp;
      }
      if (childPrompt.top_p_on && childPrompt.top_p) {
        const topP = parseFloat(childPrompt.top_p);
        if (!isNaN(topP)) apiOptions.topP = topP;
      }
      // RESPONSES API: Use max_output_tokens directly - no mapping from legacy fields
      if (childPrompt.max_output_tokens_on && childPrompt.max_output_tokens) {
        const maxOT = parseInt(childPrompt.max_output_tokens, 10);
        if (!isNaN(maxOT)) {
          apiOptions.maxOutputTokens = maxOT;
          console.log('Using max_output_tokens setting:', maxOT);
        }
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
      // Handle reasoning effort - check if enabled and model supports it
      if (childPrompt.reasoning_effort_on && childPrompt.reasoning_effort) {
        apiOptions.reasoningEffort = childPrompt.reasoning_effort;
        console.log('Using prompt-level reasoning_effort:', childPrompt.reasoning_effort);
      }
      
      // ============================================================================
      // MODEL DEFAULTS FALLBACK CHAIN
      // Priority: 1) Prompt-level, 2) Assistant override, 3) Model defaults, 4) Model config
      // ============================================================================
      const resolvedModelId = apiOptions.model || assistantData.model_override || await getDefaultModelFromSettings(supabase);
      
      // Fetch model defaults from q_model_defaults table
      const { data: modelDefaults } = await supabase
        .from(TABLES.MODEL_DEFAULTS)
        .select('*')
        .eq('model_id', resolvedModelId)
        .maybeSingle();
      
      // Apply model defaults as fallback for maxOutputTokens (Responses API)
      if (apiOptions.maxOutputTokens === undefined) {
        // Use max_output_tokens from model defaults table
        if (modelDefaults?.max_output_tokens_on && modelDefaults?.max_output_tokens) {
          const defaultMaxOT = parseInt(modelDefaults.max_output_tokens, 10);
          if (!isNaN(defaultMaxOT) && defaultMaxOT > 0) {
            apiOptions.maxOutputTokens = defaultMaxOT;
            console.log('Using model default max_output_tokens:', defaultMaxOT);
          }
        }
        // Final fallback: use model's max_output_tokens from q_models
        if (apiOptions.maxOutputTokens === undefined) {
          const modelConfig = await fetchModelConfig(supabase, resolvedModelId);
          if (modelConfig?.maxOutputTokens) {
            apiOptions.maxOutputTokens = modelConfig.maxOutputTokens;
            console.log('Using model config max_output_tokens:', modelConfig.maxOutputTokens);
          }
        }
      }
      
      // Temperature fallback chain
      if (apiOptions.temperature === undefined) {
        if (modelDefaults?.temperature_on && modelDefaults?.temperature) {
          const defaultTemp = parseFloat(modelDefaults.temperature);
          if (!isNaN(defaultTemp)) {
            apiOptions.temperature = defaultTemp;
            console.log('Using model default temperature:', defaultTemp);
          }
        }
      }
      
      // Top P fallback chain
      if (apiOptions.topP === undefined) {
        if (modelDefaults?.top_p_on && modelDefaults?.top_p) {
          const defaultTopP = parseFloat(modelDefaults.top_p);
          if (!isNaN(defaultTopP)) {
            apiOptions.topP = defaultTopP;
            console.log('Using model default top_p:', defaultTopP);
          }
        }
      }
      
      // Reasoning effort fallback chain
      if (apiOptions.reasoningEffort === undefined) {
        if (modelDefaults?.reasoning_effort_on && modelDefaults?.reasoning_effort) {
          apiOptions.reasoningEffort = modelDefaults.reasoning_effort;
          console.log('Using model default reasoning_effort:', modelDefaults.reasoning_effort);
        }
      }
      
      // Log all extracted apiOptions for debugging
      console.log('Extracted apiOptions from prompt (after model defaults fallback):', {
        model: apiOptions.model,
        temperature: apiOptions.temperature,
        maxOutputTokens: apiOptions.maxOutputTokens,
        reasoningEffort: apiOptions.reasoningEffort,
        toolChoice: apiOptions.toolChoice,
        resolvedModelId,
      });

      // Handle action nodes - prepend action system prompt and set structured output
      if (childPrompt.node_type === 'action') {
        console.log('Action node detected:', {
          prompt_row_id: child_prompt_row_id,
          prompt_name: childPrompt.prompt_name,
          json_schema_template_id: childPrompt.json_schema_template_id || null,
          response_format_type: typeof childPrompt.response_format,
          response_format_preview: typeof childPrompt.response_format === 'string' 
            ? childPrompt.response_format.substring(0, 100) 
            : 'object',
        });
        
        let schemaToUse: any = null;
        let schemaName = 'action_response';
        
        // Priority 1: Fetch schema from json_schema_template_id if set
        if (childPrompt.json_schema_template_id) {
          try {
            const { data: schemaTemplate } = await supabase
              .from(TABLES.JSON_SCHEMA_TEMPLATES)
              .select('json_schema, schema_name')
              .eq('row_id', childPrompt.json_schema_template_id)
              .maybeSingle();
            
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
            const rawFormat = childPrompt.response_format;
            // Skip if response_format is just a simple string like "text"
            if (typeof rawFormat === 'string' && !rawFormat.trim().startsWith('{')) {
              console.log('Action node: response_format is not a JSON object, skipping:', rawFormat);
            } else {
              const format = typeof rawFormat === 'string' 
                ? JSON.parse(rawFormat) 
                : rawFormat;
              
              if (format.type === 'json_schema' && format.json_schema?.schema) {
                schemaToUse = format.json_schema.schema;
                schemaName = format.json_schema?.name || 'action_response';
                console.log('Action node: using schema from response_format');
              } else if (format.type === 'json_schema' && !format.json_schema?.schema) {
                console.warn('Action node: response_format has json_schema type but no schema object');
              }
            }
          } catch (err) {
            console.warn('Could not parse response_format:', err, 'Value preview:', 
              typeof childPrompt.response_format === 'string' 
                ? childPrompt.response_format.substring(0, 100) 
                : 'object');
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
          const { data: customPrompt } = await supabase
            .from(TABLES.SETTINGS)
            .select('setting_value')
            .eq('setting_key', 'default_action_system_prompt')
            .maybeSingle();
          
          if (customPrompt?.setting_value) {
            actionSystemPrompt = customPrompt.setting_value;
          }
          
          actionSystemPrompt = actionSystemPrompt.replace('{{schema_description}}', schemaDesc);
          
          systemPrompt = systemPrompt
            ? `${actionSystemPrompt}\n\n---\n\n${systemPrompt}`
            : actionSystemPrompt;
          
          console.log('Action node: applied structured output format with schema:', schemaName);
        } else {
          // No schema found - use a sensible default for action nodes
          console.warn('Action node: no schema found, using default items schema');
          
          // Default schema that matches the common action node use case
          schemaToUse = {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    content: { type: 'string' }
                  },
                  required: ['name', 'content'],
                  additionalProperties: false
                }
              }
            },
            required: ['items'],
            additionalProperties: false
          };
          schemaName = 'default_action_response';
          
          // Set the responseFormat with the default schema
          apiOptions.responseFormat = {
            type: 'json_schema',
            json_schema: {
              name: schemaName,
              strict: true,
              schema: schemaToUse,
            },
          };
          
          const schemaDesc = formatSchemaForPrompt(schemaToUse);
          
          // Still apply the action system prompt
          let actionSystemPrompt = DEFAULT_ACTION_SYSTEM_PROMPT;
          const { data: customPrompt } = await supabase
            .from(TABLES.SETTINGS)
            .select('setting_value')
            .eq('setting_key', 'default_action_system_prompt')
            .maybeSingle();
          
          if (customPrompt?.setting_value) {
            actionSystemPrompt = customPrompt.setting_value;
          }
          
          actionSystemPrompt = actionSystemPrompt.replace('{{schema_description}}', schemaDesc);
          
          systemPrompt = systemPrompt
            ? `${actionSystemPrompt}\n\n---\n\n${systemPrompt}`
            : actionSystemPrompt;
            
          console.log('Action node: applied default structured output format');
        }
      }

      // ============================================================================
      // QUESTION NODE EXECUTION
      // Question nodes use ask_user_question tool to gather user input interactively
      // Uses dedicated runQuestionNodeAPI function with tool execution loop
      // ============================================================================
      if (childPrompt.node_type === 'question') {
        console.log('Question node detected - using question-specific execution path:', {
          prompt_row_id: child_prompt_row_id,
          prompt_name: childPrompt.prompt_name,
          question_config: childPrompt.question_config,
        });
        
        const questionConfig = childPrompt.question_config || { max_questions: 10 };
        const defaultModel = await getDefaultModelFromSettings(supabase);
        const promptModel = (childPrompt.model_on && childPrompt.model) ? childPrompt.model : null;
        const resolvedModel = await resolveModelFromDb(supabase, promptModel || assistantData.model_override || defaultModel);
        
        // Emit progress for question node
        emitter.emit({ 
          type: 'progress', 
          stage: 'calling_api', 
          model: resolvedModel,
          prompt_name: childPrompt.prompt_name,
          node_type: 'question',
          elapsed_ms: Date.now() - startTime 
        });
        
        const questionResult = await runQuestionNodeAPI({
          model: resolvedModel,
          userMessage: finalMessage,
          systemPrompt: systemPrompt,
          // For question nodes: only use previous_response_id if we're resuming with a call_id
          // This prevents "no tool output" errors from stale interrupted responses
          previousResponseId: resumeCallId ? resumeResponseId : null,
          resumeCallId: resumeCallId,
          maxQuestions: questionConfig.max_questions || 10,
          questionConfig,
          promptRowId: child_prompt_row_id,
          userId: validation.user!.id,
          apiKey: OPENAI_API_KEY,
          supabase,
          emitter,
          threadRowId: activeThreadRowId,  // For stale response recovery
          // Pass tool configuration - same as regular prompts
          fileSearchEnabled: apiOptions.fileSearchEnabled,
          codeInterpreterEnabled: apiOptions.codeInterpreterEnabled,
          webSearchEnabled: apiOptions.webSearchEnabled,
          vectorStoreIds: apiOptions.vectorStoreIds,
          // Pass file context for system prompt injection
          fileContext: fileContext,
          confluenceContext: confluenceContext,
        });
        
        if (questionResult.interrupted) {
          // User input is required - frontend will handle the interrupt
          // Update thread with response_id for resume
          if (questionResult.response_id?.startsWith('resp_')) {
            await updateFamilyThreadResponseId(supabase, activeThreadRowId, questionResult.response_id);
          }
          console.log('Question node: waiting for user input');
          return; // Stream already has user_input_required event, close will happen in finally
        }
        
        if (questionResult.success && questionResult.response) {
          // Store response
          await supabase
            .from(TABLES.PROMPTS)
            .update({ 
              output_response: questionResult.response,
              last_ai_call_metadata: {
                latency_ms: Date.now() - startTime,
                model: resolvedModel,
                tokens_input: questionResult.usage?.prompt_tokens || 0,
                tokens_output: questionResult.usage?.completion_tokens || 0,
                tokens_total: questionResult.usage?.total_tokens || 0,
                response_id: questionResult.response_id,
                node_type: 'question',
              }
            })
            .eq('row_id', child_prompt_row_id);
          
          // Update thread
          if (questionResult.response_id?.startsWith('resp_')) {
            await updateFamilyThreadResponseId(supabase, activeThreadRowId, questionResult.response_id);
          }
          
          emitter.emit({
            type: 'complete',
            success: true,
            response: questionResult.response,
            usage: questionResult.usage,
            model: resolvedModel,
            child_prompt_name: childPrompt.prompt_name,
            thread_row_id: activeThreadRowId,
            response_id: questionResult.response_id,
            elapsed_ms: Date.now() - startTime,
            node_type: 'question',
          });
          return;
        }
        
        if (!questionResult.success) {
          emitter.emit({
            type: 'error',
            error: questionResult.error || 'Question node execution failed',
            error_code: 'QUESTION_NODE_ERROR',
            prompt_name: childPrompt.prompt_name,
          });
          return;
        }
      }

      // Add seed if enabled
      if (childPrompt.seed_on && childPrompt.seed) {
        const seed = parseInt(childPrompt.seed, 10);
        if (!isNaN(seed)) {
          apiOptions.seed = seed;
        }
      }


      // Get model for display - respect prompt-level override
      const defaultModel = await getDefaultModelFromSettings(supabase);
      const promptModel = (childPrompt.model_on && childPrompt.model) ? childPrompt.model : null;
      const modelUsedForMetadata = promptModel || assistantData.model_override || defaultModel;

      // Emit calling_api progress
      emitter.emit({ 
        type: 'progress', 
        stage: 'calling_api', 
        model: modelUsedForMetadata,
        prompt_name: childPrompt.prompt_name,
        elapsed_ms: Date.now() - startTime 
      });

      // Emit resolved settings for dashboard display (before API call)
      emitter.emit({
        type: 'settings_resolved',
        settings: {
          model: modelUsedForMetadata,
          temperature: apiOptions.temperature,
          max_output_tokens: apiOptions.maxOutputTokens,
          top_p: apiOptions.topP,
          frequency_penalty: apiOptions.frequencyPenalty,
          presence_penalty: apiOptions.presencePenalty,
          reasoning_effort: apiOptions.reasoningEffort,
          tool_choice: apiOptions.toolChoice,
          seed: apiOptions.seed,
          response_format: apiOptions.responseFormat?.type || null,
        },
        tools: {
          web_search: !!apiOptions.webSearchEnabled,
          confluence: !!confluenceContext,
          code_interpreter: !!apiOptions.codeInterpreterEnabled,
          file_search: !!apiOptions.fileSearchEnabled,
        },
      });

      // Call OpenAI Responses API (with emitter for api_started event)
      // Pass last_response_id for multi-turn context (avoids reasoning item issues)
      const result = await runResponsesAPI(
        assistantData,
        finalMessage,
        systemPrompt,
        conversationId,
        familyThread.last_response_id,
        OPENAI_API_KEY,
        supabase,
        apiOptions,
        emitter, // Pass emitter for api_started event with response_id
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

      // Update thread with new response_id for multi-turn context chaining
      if (result.response_id?.startsWith('resp_')) {
        const updated = await updateFamilyThreadResponseId(supabase, activeThreadRowId, result.response_id);
        if (!updated) {
          console.warn('Failed to persist response_id - next turn may lose conversation context');
        }
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
