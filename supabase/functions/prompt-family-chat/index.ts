import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getDefaultModelFromSettings, fetchModelConfig } from "../_shared/models.ts";
import { loadQonsolKnowledge, getQonsolHelpTool, handleQonsolHelpToolCall } from "../_shared/knowledge.ts";
import { 
  getPromptFamilyTree, 
  getFamilyPromptIds, 
  getFamilyFiles, 
  getFamilyConfluencePages, 
  getFamilyJsonSchemas,
  getFamilyVariables,
  getPromptFamilySummary,
  getPromptFamilyTools,
  getFamilyDataOptimized
} from "../_shared/promptFamily.ts";
import { TABLES } from "../_shared/tables.ts";
import { getOrCreateFamilyThread, updateFamilyThreadResponseId } from "../_shared/familyThreads.ts";

// Tool Registry imports (Phase 2)
import { 
  getToolsForScope, 
  executeToolCall as registryExecuteToolCall,
  validateRegistry,
  type ToolContext 
} from "../_shared/tools/index.ts";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getOpenAIApiKey, getAnthropicApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES } from "../_shared/errorCodes.ts";
import { 
  buildAnthropicRequest, 
  callAnthropicAPIStreaming, 
  parseAnthropicStreamEvent,
  type AnthropicMessage,
  type AnthropicStreamEvent 
} from "../_shared/anthropic.ts";

// Feature flag for gradual rollout - set to 'true' to enable new registry
const USE_TOOL_REGISTRY = Deno.env.get('USE_TOOL_REGISTRY') === 'true';

// ============================================================================
// SSE STREAMING INFRASTRUCTURE
// ============================================================================

interface SSEEmitter {
  emit: (event: any) => void;
  close: () => void;
  dispose: () => void;
  isClosed: () => boolean;
}

function createSSEStream(): { stream: ReadableStream; emitter: SSEEmitter } {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let streamClosed = false;
  let disposed = false;
  
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel(reason) {
      disposed = true;
      streamClosed = true;
      console.log('SSE stream cancelled by client:', reason);
    },
  });
  
  const emitter: SSEEmitter = {
    emit: (event: any) => {
      if (disposed || streamClosed) return;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch (e) {
        if (!disposed) console.warn('SSE emit error:', e);
        streamClosed = true;
      }
    },
    close: () => {
      if (streamClosed || disposed) return;
      streamClosed = true;
      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        if (!disposed) console.warn('SSE close error:', e);
      }
    },
    dispose: () => {
      disposed = true;
      streamClosed = true;
    },
    isClosed: () => streamClosed || disposed,
  };
  
  return { stream, emitter };
}

// ============================================================================
// TOOL SCHEMA HELPERS
// ============================================================================

function normalizeToolForResponsesApi(tool: any): any {
  if (tool.function && typeof tool.function === 'object') {
    return {
      type: tool.type || 'function',
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
      ...(tool.function.strict !== undefined && { strict: tool.function.strict })
    };
  }
  return tool;
}

function ensureStrictSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(schema[key])) {
      return {
        ...schema,
        [key]: schema[key].map((s: any) => ensureStrictSchema(s))
      };
    }
  }

  if (schema.type === 'array' && schema.items) {
    return {
      ...schema,
      items: ensureStrictSchema(schema.items)
    };
  }

  if (schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)) {
    const nextProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      nextProps[k] = ensureStrictSchema(v);
    }

    return {
      ...schema,
      type: schema.type ?? 'object',
      properties: nextProps,
      additionalProperties: false,
      required: Object.keys(nextProps)
    };
  }

  return schema;
}

// ============================================================================
// USER VALIDATION
// ============================================================================

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; user?: any; supabase?: any }> {
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
    return { valid: false, error: 'Access denied' };
  }

  return { valid: true, user, supabase };
}

// ============================================================================
// TOOL EXECUTION (Legacy path)
// ============================================================================

async function handleToolCall(
  toolName: string,
  args: any,
  context: {
    supabase: any;
    userId: string;
    promptRowId: string;
    familyPromptIds: string[];
    cachedTree?: any;
    openAIApiKey?: string;
    registryContext?: ToolContext | null;
  }
): Promise<string> {
  if (USE_TOOL_REGISTRY && context.registryContext) {
    return registryExecuteToolCall(toolName, args, context.registryContext);
  }
  
  const { supabase, promptRowId, familyPromptIds, cachedTree, openAIApiKey } = context;

  try {
    switch (toolName) {
      case 'get_prompt_tree': {
        const tree = cachedTree ?? await getPromptFamilyTree(supabase, promptRowId);
        return JSON.stringify({ message: 'Prompt family tree', tree });
      }

      case 'get_prompt_details': {
        const { prompt_row_id } = args;
        
        if (!familyPromptIds.includes(prompt_row_id)) {
          return JSON.stringify({ error: 'Prompt not in this family' });
        }

        const { data: prompt, error } = await supabase
          .from(TABLES.PROMPTS)
          .select('*')
          .eq('row_id', prompt_row_id)
          .maybeSingle();

        if (error || !prompt) {
          return JSON.stringify({ error: 'Prompt not found' });
        }

        const { data: variables } = await supabase
          .from(TABLES.PROMPT_VARIABLES)
          .select('variable_name, variable_value, variable_description, is_required')
          .eq('prompt_row_id', prompt_row_id);

        return JSON.stringify({
          name: prompt.prompt_name,
          node_type: prompt.node_type,
          system_prompt: prompt.input_admin_prompt,
          user_prompt: prompt.input_user_prompt,
          output: prompt.output_response,
          model: prompt.model,
          note: prompt.note,
          post_action: prompt.post_action,
          variables: variables || []
        });
      }

      case 'list_family_files': {
        const files = await getFamilyFiles(supabase, familyPromptIds);
        return JSON.stringify({
          message: `${files.length} files attached to this family`,
          files: files.map(f => ({
            row_id: f.row_id,
            filename: f.original_filename,
            mime_type: f.mime_type,
            size: f.file_size,
            status: f.upload_status
          }))
        });
      }

      case 'read_file_content': {
        const { file_row_id } = args;
        
        const files = await getFamilyFiles(supabase, familyPromptIds);
        const file = files.find((f: any) => f.row_id === file_row_id);
        
        if (!file) {
          return JSON.stringify({ error: 'File not found in this family' });
        }
        
        const textMimeTypes = [
          'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
          'application/json', 'application/xml', 'text/x-markdown'
        ];
        
        const isTextFile = textMimeTypes.some(t => file.mime_type?.startsWith(t)) ||
          file.original_filename?.match(/\.(txt|md|csv|json|xml|html|yml|yaml|log)$/i);
        
        if (!isTextFile) {
          return JSON.stringify({ 
            error: 'Cannot read binary file content. Only text-based files are supported.',
            filename: file.original_filename,
            mime_type: file.mime_type
          });
        }
        
        if (!file.storage_path) {
          return JSON.stringify({ error: 'File has no storage path' });
        }
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('assistant-files')
          .download(file.storage_path);
        
        if (downloadError || !fileData) {
          console.error('File download error:', downloadError);
          return JSON.stringify({ error: 'Failed to download file from storage' });
        }
        
        const content = await fileData.text();
        const truncated = content.length > 50000;
        
        return JSON.stringify({
          filename: file.original_filename,
          mime_type: file.mime_type,
          size: file.file_size,
          truncated,
          content: truncated ? content.slice(0, 50000) + '\n\n[Content truncated at 50KB]' : content
        });
      }

      case 'list_family_confluence': {
        const pages = await getFamilyConfluencePages(supabase, familyPromptIds);
        return JSON.stringify({
          message: `${pages.length} Confluence pages attached`,
          pages: pages.map(p => ({
            row_id: p.row_id,
            page_id: p.page_id,
            title: p.page_title,
            url: p.page_url,
            sync_status: p.sync_status
          }))
        });
      }

      case 'read_confluence_page': {
        const { page_id } = args;
        const pages = await getFamilyConfluencePages(supabase, familyPromptIds);
        const page = pages.find(p => p.page_id === page_id);
        
        if (!page) {
          return JSON.stringify({ error: 'Page not found in this family' });
        }

        return JSON.stringify({
          title: page.page_title,
          content: page.content_text || '(Content not synced yet)',
          url: page.page_url
        });
      }

      case 'list_family_variables': {
        const variables = await getFamilyVariables(supabase, familyPromptIds);
        
        const byPrompt: Record<string, any[]> = {};
        for (const v of variables) {
          if (!byPrompt[v.prompt_row_id]) byPrompt[v.prompt_row_id] = [];
          byPrompt[v.prompt_row_id].push(v);
        }

        return JSON.stringify({
          message: `${variables.length} variables across ${Object.keys(byPrompt).length} prompts`,
          variables: byPrompt
        });
      }

      case 'list_json_schemas': {
        const schemas = await getFamilyJsonSchemas(supabase, familyPromptIds);
        return JSON.stringify({
          message: `${schemas.length} JSON schemas used`,
          schemas: schemas.map(s => ({
            row_id: s.row_id,
            name: s.schema_name,
            description: s.schema_description,
            has_action_config: !!s.action_config,
            has_child_creation: !!s.child_creation
          }))
        });
      }

      case 'get_json_schema_details': {
        const { schema_row_id } = args;
        const schemas = await getFamilyJsonSchemas(supabase, familyPromptIds);
        const schema = schemas.find(s => s.row_id === schema_row_id);
        
        if (!schema) {
          return JSON.stringify({ error: 'Schema not found in this family' });
        }

        return JSON.stringify({
          name: schema.schema_name,
          description: schema.schema_description,
          json_schema: schema.json_schema,
          action_config: schema.action_config,
          child_creation: schema.child_creation
        });
      }

      case 'search_qonsol_help': {
        return await handleQonsolHelpToolCall(args, supabase, openAIApiKey);
      }

      case 'get_database_schema': {
        const { table_name } = args;
        
        const knownTables = [
          'q_prompts', 'q_prompt_variables', 'q_prompt_library',
          'q_assistants', 'q_assistant_files', 'q_threads',
          'q_templates', 'q_json_schema_templates', 'q_export_templates',
          'q_confluence_pages', 'q_models', 'q_model_defaults',
          'q_settings', 'q_ai_costs', 'q_app_knowledge', 'q_vector_stores',
          'profiles', 'projects', 'resource_shares', 'user_roles'
        ];
        
        if (table_name) {
          const { data: sample, error: sampleError } = await supabase
            .from(table_name)
            .select('*')
            .limit(1);
          
          if (sampleError) {
            return JSON.stringify({ error: `Cannot access table: ${table_name}` });
          }
          
          const inferredColumns = sample && sample[0] 
            ? Object.keys(sample[0]).map(col => ({
                column_name: col,
                data_type: typeof sample[0][col],
                sample_value: sample[0][col]?.toString()?.substring(0, 50)
              }))
            : [];
          
          return JSON.stringify({
            table: table_name,
            columns: inferredColumns,
            note: 'Schema inferred from sample data'
          });
        }
        
        return JSON.stringify({
          tables: knownTables,
          note: 'Use table_name parameter to get column details for a specific table'
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Tool ${toolName} error:`, error);
    return JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' });
  }
}

// ============================================================================
// ANTHROPIC STREAMING RESPONSE PROCESSOR
// ============================================================================

async function streamAnthropicResponse(
  response: Response,
  emitter: SSEEmitter,
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null }> {
  if (!response.body) {
    throw new Error('No response body from Anthropic');
  }

  let accumulatedContent = '';
  let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;
        
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          
          try {
            const event: AnthropicStreamEvent = JSON.parse(jsonStr);
            const standardEvent = parseAnthropicStreamEvent(event);
            
            if (standardEvent) {
              if (standardEvent.type === 'text') {
                accumulatedContent += standardEvent.text;
                // Emit as output_text_delta to match OpenAI streaming format
                emitter.emit({ type: 'output_text_delta', delta: standardEvent.text });
              } else if (standardEvent.type === 'usage') {
                finalUsage = standardEvent.usage;
              } else if (standardEvent.type === 'done') {
                // Stream complete
              } else if (standardEvent.type === 'error') {
                emitter.emit({ type: 'error', error: standardEvent.error, error_code: standardEvent.error_code });
              }
            }
            
            // Track input tokens from message_start
            if (event.type === 'message_start' && event.message?.usage?.input_tokens) {
              const inputTokens = event.message.usage.input_tokens;
              if (finalUsage) {
                finalUsage.prompt_tokens = inputTokens;
                finalUsage.total_tokens = inputTokens + finalUsage.completion_tokens;
              } else {
                finalUsage = { prompt_tokens: inputTokens, completion_tokens: 0, total_tokens: inputTokens };
              }
            }
          } catch (parseErr) {
            console.warn('Failed to parse Anthropic stream event:', jsonStr);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content: accumulatedContent, usage: finalUsage };
}

// ============================================================================
// STREAMING OPENAI RESPONSE PROCESSOR

async function streamOpenAIResponse(
  responseId: string,
  openAIApiKey: string,
  emitter: SSEEmitter,
): Promise<{ content: string | null; toolCalls: any[]; usage: any | null; status: string }> {
  const IDLE_TIMEOUT_MS = 300000; // 5 minutes
  const streamController = new AbortController();
  let idleTimeoutId: number | null = null;
  let abortReason: 'idle' | null = null;
  
  const resetIdleTimeout = () => {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(() => {
      abortReason = 'idle';
      console.error('Stream idle timeout - no data for 5 minutes');
      streamController.abort();
    }, IDLE_TIMEOUT_MS);
  };

  // Polling fallback
  const pollForCompletion = async (): Promise<{ content: string | null; toolCalls: any[]; usage: any | null; status: string }> => {
    const maxWaitMs = 600000;
    const intervalMs = 3000;
    const startTime = Date.now();
    
    console.log('Falling back to polling for response:', responseId);
    
    while (Date.now() - startTime < maxWaitMs) {
      console.log('Polling iteration - elapsed:', Math.round((Date.now() - startTime) / 1000), 's');
      try {
        const response = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
          headers: { 'Authorization': `Bearer ${openAIApiKey}` },
        });
        
        if (!response.ok) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        }
        
        const data = await response.json();
        console.log('Polling response status:', data.status);
        
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          let content: string | null = null;
          const toolCalls: any[] = [];
          
          if (data.output && Array.isArray(data.output)) {
            for (const item of data.output) {
              if (item.type === 'message' && item.content) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    content = (content || '') + contentItem.text;
                  }
                }
              }
              if (item.type === 'function_call') {
                toolCalls.push(item);
              }
              // Detect built-in tool execution in polling fallback (correct OpenAI types)
              if (['file_search', 'web_search_preview', 'code_interpreter'].includes(item.type)) {
                console.log('Built-in tool in polling response:', item.type, 'results:', item.results?.length || 0);
                emitter.emit({ type: 'tool_activity', tool: item.type, status: 'completed' });
              }
            }
          }
          
          // Emit usage for live dashboard updates (polling fallback)
          if (data.usage) {
            emitter.emit({
              type: 'usage_delta',
              input_tokens: data.usage.input_tokens || 0,
              output_tokens: data.usage.output_tokens || 0,
            });
          }
          
          return { content, toolCalls, usage: data.usage, status: data.status };
        }
        
        // Emit progress to keep client informed during polling
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);
        emitter.emit({ 
          type: 'progress', 
          message: `Processing... (${elapsedSec}s elapsed)`,
          status: data.status || 'queued'
        });
        
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (pollError) {
        console.error('Polling error:', pollError);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    return { content: null, toolCalls: [], usage: null, status: 'timeout' };
  };

  resetIdleTimeout();
  
  console.log('Starting stream fetch for response:', responseId);
  
  let streamResponse: Response;
  try {
    streamResponse = await fetch(
      `https://api.openai.com/v1/responses/${responseId}?stream=true`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${openAIApiKey}` },
        signal: streamController.signal,
      }
    );
  } catch (streamError: unknown) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    if (streamError instanceof Error && streamError.name === 'AbortError' && abortReason === 'idle') {
      return await pollForCompletion();
    }
    throw streamError;
  }

  console.log('Stream response received, status:', streamResponse.status);
  
  if (!streamResponse.ok) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    console.error('Stream response error:', streamResponse.status);
    return await pollForCompletion();
  }

  const reader = streamResponse.body?.getReader();
  if (!reader) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    return { content: null, toolCalls: [], usage: null, status: 'error' };
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedContent = '';
  const toolCalls: any[] = [];
  let finalUsage: any = null;
  let finalStatus = 'in_progress';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetIdleTimeout();
      buffer += decoder.decode(value, { stream: true });

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
          
          // Track status
          if (event.status) {
            finalStatus = event.status;
            emitter.emit({ type: 'status_update', status: event.status });
          }
          
          // Handle cancelled/failed
          if (event.status === 'cancelled' || event.status === 'failed') {
            if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
            reader.cancel();
            return { content: null, toolCalls: [], usage: null, status: event.status };
          }
          
          // Capture usage and emit for live dashboard
          if (event.usage) {
            finalUsage = event.usage;
            emitter.emit({
              type: 'usage_delta',
              input_tokens: event.usage.input_tokens || 0,
              output_tokens: event.usage.output_tokens || 0,
            });
          }
          
          // Extract content from output
          if (event.output && Array.isArray(event.output)) {
            for (const item of event.output) {
              if (item.type === 'message' && item.content) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'output_text' && contentItem.text) {
                    accumulatedContent = contentItem.text;
                  }
                }
              }
              // Reasoning content from completed output
              if (item.type === 'reasoning' && item.summary && Array.isArray(item.summary)) {
                emitter.emit({ type: 'thinking_started', item_id: item.id });
                for (const summaryPart of item.summary) {
                  if (summaryPart.text) {
                    emitter.emit({ type: 'thinking_delta', delta: summaryPart.text, item_id: item.id });
                  }
                }
              }
              // Collect function tool calls
              if (item.type === 'function_call') {
                toolCalls.push(item);
              }
              // Detect built-in tool execution and emit activity (correct OpenAI types)
              if (['file_search', 'web_search_preview', 'code_interpreter'].includes(item.type)) {
                console.log('Built-in tool executed:', item.type, 'results:', item.results?.length || 0);
                emitter.emit({ type: 'tool_activity', tool: item.type, status: 'completed' });
              }
            }
          }
          
          // Streaming reasoning events
          if (event.type === 'response.output_item.added' && event.item?.type === 'reasoning') {
            console.log('Reasoning item started:', event.item.id);
            emitter.emit({ type: 'thinking_started', item_id: event.item.id });
          }
          
          if (event.type === 'response.reasoning_summary_part.added') {
            const partText = event.part?.text || '';
            if (partText) {
              emitter.emit({ type: 'thinking_delta', delta: partText, item_id: event.item_id });
            }
          }
          
          if (event.type === 'response.reasoning_summary_text.delta') {
            emitter.emit({ type: 'thinking_delta', delta: event.delta || '', item_id: event.item_id });
          }
          
          if (event.type === 'response.reasoning_summary_text.done') {
            emitter.emit({ type: 'thinking_done', text: event.text || '', item_id: event.item_id });
          }
          
          // Event: response.output_text.delta (streaming main output text)
          if (event.type === 'response.output_text.delta') {
            emitter.emit({
              type: 'output_text_delta',
              delta: event.delta || '',
              item_id: event.item_id,
            });
          }
          
          // Event: response.output_text.done (output text complete)
          if (event.type === 'response.output_text.done') {
            emitter.emit({
              type: 'output_text_done',
              text: event.text || '',
              item_id: event.item_id,
            });
          }
          
        } catch (parseErr) {
          console.warn('Failed to parse stream event:', data);
        }
      }
    }
  } catch (streamReadError: unknown) {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
    if (streamReadError instanceof Error && streamReadError.name === 'AbortError' && abortReason === 'idle') {
      return await pollForCompletion();
    }
    throw streamReadError;
  } finally {
    if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
  }

  return { content: accumulatedContent || null, toolCalls, usage: finalUsage, status: finalStatus };
}

// ============================================================================
// TOOL EXECUTION WITH STREAMING
// ============================================================================

async function executeToolsAndSubmitStreaming(
  toolCalls: any[],
  toolContext: any,
  previousResponseId: string,
  selectedModel: string,
  openAIApiKey: string,
  emitter: SSEEmitter,
  maxOutputTokens?: number,
): Promise<{ content: string | null; hasMoreTools: boolean; nextToolCalls: any[]; responseId: string | null }> {
  const toolResults: any[] = [];
  
  for (const toolCall of toolCalls) {
    const toolName = toolCall.name;
    let toolArgs = {};
    
    try {
      toolArgs = JSON.parse(toolCall.arguments || '{}');
    } catch (e) {
      console.error('Failed to parse tool arguments:', toolCall.arguments);
    }

    emitter.emit({ type: 'tool_start', tool: toolName, args: toolArgs });
    console.log(`Executing tool: ${toolName}`, toolArgs);
    
    const toolResult = await handleToolCall(toolName, toolArgs, toolContext);
    console.log(`Tool ${toolName} result length: ${toolResult.length}`);
    
    // Check for user_input_required interrupt marker BEFORE adding to results
    try {
      const parsed = JSON.parse(toolResult);
      if (parsed.__interrupt === 'user_input_required') {
        // Emit special event to frontend - this pauses the conversation
        emitter.emit({
          type: 'user_input_required',
          variable_name: parsed.variable_name,
          question: parsed.question,
          description: parsed.description,
          call_id: toolCall.call_id
        });
        
        console.log('Question interrupt - waiting for user input');
        
        // Return early - don't submit to OpenAI, conversation is paused
        return { 
          content: null, 
          hasMoreTools: false, 
          nextToolCalls: [], 
          responseId: previousResponseId 
        };
      }
    } catch {
      // Not JSON or not our interrupt type - continue normally
    }

    emitter.emit({ type: 'tool_end', tool: toolName });

    toolResults.push({
      type: 'function_call_output',
      call_id: toolCall.call_id,
      output: toolResult
    });
  }

  // Submit with background mode for streaming
  const requestBody: any = {
    model: selectedModel,
    input: toolResults,
    store: true,
    background: true,
  };
  
  // CRITICAL: Include max_output_tokens in tool submission to prevent uncapped output
  if (maxOutputTokens !== undefined) {
    requestBody.max_output_tokens = maxOutputTokens;
    console.log('Tool submit using max_output_tokens:', maxOutputTokens);
  }
  
  if (previousResponseId?.startsWith('resp_')) {
    requestBody.previous_response_id = previousResponseId;
    console.log('Tool submit chaining from response:', previousResponseId);
  }
  
  const submitResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('Tool submit error:', submitResponse.status, errorText);
    return { content: null, hasMoreTools: false, nextToolCalls: [], responseId: null };
  }

  const submitResult = await submitResponse.json();
  const responseId = submitResult.id || null;
  console.log('Tool submit response id:', responseId, 'status:', submitResult.status);
  
  // Emit api_started for dashboard
  emitter.emit({ type: 'api_started', response_id: responseId, status: submitResult.status });

  // If completed immediately, extract content
  if (submitResult.status === 'completed') {
    let content: string | null = null;
    const nextToolCalls: any[] = [];
    
    if (submitResult.output && Array.isArray(submitResult.output)) {
      for (const item of submitResult.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              content = contentItem.text;
            }
          }
        }
        if (item.type === 'function_call') {
          nextToolCalls.push(item);
        }
        // Detect built-in tool execution in completed response (correct OpenAI types)
        if (['file_search', 'web_search_preview', 'code_interpreter'].includes(item.type)) {
          console.log('Built-in tool in completed response:', item.type, 'results:', item.results?.length || 0);
          emitter.emit({ type: 'tool_activity', tool: item.type, status: 'completed' });
        }
      }
    }
    
    // Emit content for immediate tool completion (no streaming occurred)
    if (content) {
      emitter.emit({ type: 'output_text_done', text: content });
    }
    
    return { content, hasMoreTools: nextToolCalls.length > 0, nextToolCalls, responseId };
  }

  // Stream the response
  const streamResult = await streamOpenAIResponse(responseId, openAIApiKey, emitter);
  
  return {
    content: streamResult.content,
    hasMoreTools: streamResult.toolCalls.length > 0,
    nextToolCalls: streamResult.toolCalls,
    responseId,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  // Create SSE stream for real-time events
  const { stream, emitter } = createSSEStream();
  const startTime = Date.now();
  let heartbeatInterval: number | null = null;

  // Process request in background while streaming
  (async () => {
    try {
      const validation = await validateUser(req);
      if (!validation.valid) {
        console.error('Auth validation failed:', validation.error);
        emitter.emit({ type: 'error', error: validation.error, error_code: 'AUTH_FAILED' });
        emitter.close();
        return;
      }

      // Start heartbeat after validation
      heartbeatInterval = setInterval(() => {
        if (!emitter.isClosed()) {
          emitter.emit({ type: 'heartbeat', elapsed_ms: Date.now() - startTime });
        }
      }, 10000);

      console.log('Prompt family chat request from:', validation.user?.email);

      const body = await req.json();
      const { prompt_row_id, user_message, system_prompt, model, reasoning_effort } = body;

      // Input validation
      if (!prompt_row_id) {
        emitter.emit({ type: 'error', error: 'prompt_row_id is required' });
        emitter.close();
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof prompt_row_id !== 'string' || !uuidRegex.test(prompt_row_id)) {
        emitter.emit({ type: 'error', error: 'prompt_row_id must be a valid UUID' });
        emitter.close();
        return;
      }

      if (!user_message || typeof user_message !== 'string') {
        emitter.emit({ type: 'error', error: 'user_message is required and must be a string' });
        emitter.close();
        return;
      }

      if (user_message.length > 100000) {
        emitter.emit({ type: 'error', error: 'Message exceeds 100KB limit' });
        emitter.close();
        return;
      }

      const authHeader = req.headers.get('Authorization')!;
      const openAIApiKey = await getOpenAIApiKey(authHeader);
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        emitter.emit({ type: 'error', error: 'Missing Supabase configuration' });
        emitter.close();
        return;
      }

      if (!openAIApiKey) {
        emitter.emit({ 
          type: 'error', 
          error: 'OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.',
          error_code: ERROR_CODES.OPENAI_NOT_CONFIGURED
        });
        emitter.close();
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Verify ownership
      const { data: promptCheck, error: promptCheckError } = await supabase
        .from(TABLES.PROMPTS)
        .select('owner_id')
        .eq('row_id', prompt_row_id)
        .maybeSingle();

      if (promptCheckError || !promptCheck) {
        emitter.emit({ type: 'error', error: 'Prompt not found' });
        emitter.close();
        return;
      }

      if (promptCheck.owner_id !== validation.user?.id) {
        const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: validation.user?.id });
        if (!isAdmin) {
          emitter.emit({ type: 'error', error: 'Access denied - you do not own this prompt' });
          emitter.close();
          return;
        }
      }

      // Emit progress
      emitter.emit({ type: 'progress', message: 'Loading prompt family data...' });

      // Optimized initialization
      const [familyData, knowledge, modelSetting] = await Promise.all([
        getFamilyDataOptimized(supabase, prompt_row_id),
        loadQonsolKnowledge(supabase, [
          'overview', 'prompts', 'variables', 'cascade', 'json_schemas', 'actions', 'troubleshooting'
        ], 6000),
        model ? Promise.resolve({ setting_value: model }) : supabase
          .from('q_settings')
          .select('setting_value')
          .eq('setting_key', 'default_model')
          .maybeSingle()
          .then((r: any) => r.data)
      ]);
      
      const { familyPromptIds, familySummary, tree: cachedTree, rootId } = familyData;
      
      // Build promptsMap
      const promptsMap = new Map<string, { row_id: string; parent_row_id: string | null }>();
      function buildPromptsMap(node: any) {
        if (!node) return;
        promptsMap.set(node.row_id, { row_id: node.row_id, parent_row_id: node.parent_row_id || null });
        if (node.children) {
          for (const child of node.children) {
            buildPromptsMap(child);
          }
        }
      }
      if (cachedTree) buildPromptsMap(cachedTree);
      
      // Get/create chat thread - uses purpose='chat' for isolation from prompt execution
      const familyThread = await getOrCreateFamilyThread(
        supabase,
        rootId,
        validation.user!.id,
        'Chat',
        openAIApiKey,
        'openai',  // provider
        'chat'     // purpose: isolated from 'run' threads
      );
      
      const lastResponseId = familyThread.last_response_id;
      const threadRowId = familyThread.row_id;
      
      console.log(`Init complete: ${familyPromptIds.length} prompts, rootId=${rootId}, threadRowId=${threadRowId}`);

      // Resolve model
      let selectedModel = model;
      if (!selectedModel && modelSetting?.setting_value) {
        selectedModel = modelSetting.setting_value;
      }
      if (!selectedModel) {
        selectedModel = await getDefaultModelFromSettings(supabase);
      }

      const modelConfig = await fetchModelConfig(supabase, selectedModel);

      // Build system prompt
      const systemContent = system_prompt || `You are an AI assistant helping the user with their prompt family in Qonsol, a prompt engineering platform.

You have deep knowledge of how Qonsol works and can help users:
- Understand their prompt structure and hierarchy
- Debug issues with prompts, variables, or outputs
- Explain how features work (variables, templates, JSON schemas, cascades)
- Suggest improvements to their prompts
- Answer questions about attached files and Confluence pages

${familySummary}
${knowledge}

Use your tools to explore the prompt family and provide helpful, accurate information.
Be concise but thorough. When showing prompt content, format it nicely.`;

      // Check admin status
      const { data: isUserAdmin } = await supabase.rpc('is_admin', { _user_id: validation.user!.id });

      // Get tools
      let tools: any[];
      let registryContext: ToolContext | null = null;
      // authHeader already declared above for OpenAI key lookup
      const accessToken = authHeader?.replace('Bearer ', '');
      
      if (USE_TOOL_REGISTRY) {
        console.log('Using tool registry');
        const registryValidation = validateRegistry();
        if (!registryValidation.valid) {
          console.error('Tool registry validation errors:', registryValidation.errors);
        }
        
        registryContext = {
          supabase,
          userId: validation.user!.id,
          accessToken,
          executionStack: [],
          isAdmin: !!isUserAdmin,
          familyContext: {
            promptRowId: prompt_row_id,
            familyPromptIds,
            cachedTree,
            promptsMap
          },
          credentials: {
            openAIApiKey,
            githubToken: Deno.env.get('GITHUB_TOKEN')
          }
        };
        
        tools = getToolsForScope('family', registryContext);
      } else {
        const databaseSchemaTool = {
          type: "function",
          name: "get_database_schema",
          description: "Get the database schema for Qonsol tables.",
          parameters: {
            type: "object",
            properties: {
              table_name: { type: "string", description: "Optional specific table name." }
            },
            required: [],
            additionalProperties: false
          }
        };

        const rawTools = [...getPromptFamilyTools(), getQonsolHelpTool(), databaseSchemaTool];
        tools = rawTools.map(normalizeToolForResponsesApi);
      }

      // Filter out question tools - they're only for run mode, not chat mode
      // These tools require frontend orchestration that chat mode doesn't support
      const QUESTION_TOOL_NAMES = ['ask_user_question', 'store_qa_response', 'complete_communication'];
      tools = tools.filter(t => !QUESTION_TOOL_NAMES.includes(t.name));
      console.log('Filtered question tools for chat mode');

      // Enforce strict schemas
      tools = tools.map((t) => {
        if (!t || typeof t !== 'object' || !t.parameters) return t;
        return { ...t, parameters: ensureStrictSchema(t.parameters) };
      });

      // Validate tools
      const invalidTools = tools.filter(t => !t.name);
      if (invalidTools.length > 0) {
        console.error('Invalid tools - missing name');
        emitter.emit({ type: 'error', error: 'Invalid tool configuration' });
        emitter.close();
        return;
      }

      console.log('Tools prepared:', tools.map(t => t.name));

      // Tool context
      const toolContext = {
        supabase,
        userId: validation.user!.id,
        promptRowId: prompt_row_id,
        familyPromptIds,
        cachedTree,
        openAIApiKey,
        registryContext
      };

      // Build initial request with background mode
      const requestBody: any = {
        model: selectedModel,
        input: user_message,
        instructions: systemContent,
        tools: tools.length > 0 ? tools : undefined,
        store: true,
        background: true,
      };

      // Responses API: Add max_output_tokens if model has it configured
      if (modelConfig?.maxOutputTokens) {
        requestBody.max_output_tokens = modelConfig.maxOutputTokens;
        console.log('Using max_output_tokens:', modelConfig.maxOutputTokens);
      }

      // Apply reasoning effort
      if (reasoning_effort && reasoning_effort !== 'auto') {
        const supportsReasoning = modelConfig?.supportsReasoningEffort ?? false;
        const validLevels = modelConfig?.reasoningEffortLevels || ['low', 'medium', 'high'];
        
        if (supportsReasoning && validLevels.includes(reasoning_effort)) {
          requestBody.reasoning = { 
            effort: reasoning_effort,
            summary: "auto"  // Request reasoning summaries from OpenAI
          };
          console.log(`Applied reasoning effort: ${reasoning_effort} with summary: auto`);
        }
      }

      // Use previous_response_id for conversation continuity
      if (lastResponseId?.startsWith('resp_')) {
        requestBody.previous_response_id = lastResponseId;
        console.log('Continuing from previous response:', lastResponseId);
      }

      emitter.emit({ type: 'progress', message: 'Calling AI model...' });

      // ======================================================================
      // PROVIDER ROUTING
      // ======================================================================
      const provider = modelConfig?.provider || 'openai';
      
      if (provider === 'anthropic') {
        // --- ANTHROPIC PROVIDER (streaming, no tools) ---
        console.log('Using Anthropic provider for model:', selectedModel);
        
        const anthropicApiKey = await getAnthropicApiKey(authHeader);
        if (!anthropicApiKey) {
          emitter.emit({
            type: 'error',
            error: 'Anthropic API key not configured. Add your key in Settings → Integrations → Anthropic.',
            error_code: ERROR_CODES.ANTHROPIC_NOT_CONFIGURED
          });
          emitter.close();
          return;
        }

        // Reconstruct message history from thread (Anthropic is stateless)
        const messages: AnthropicMessage[] = [];
        
        if (threadRowId) {
          const { data: threadMessages } = await supabase
            .from('q_prompt_family_messages')
            .select('role, content')
            .eq('thread_row_id', threadRowId)
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

        // Build Anthropic request (no tools for now)
        const anthropicRequest = buildAnthropicRequest(
          modelConfig?.apiModelId || selectedModel,
          messages,
          {
            systemPrompt: systemContent,
            maxTokens: modelConfig?.maxOutputTokens || 4096,
            temperature: modelConfig?.supportsTemperature ? undefined : undefined,
            stream: true,
          }
        );

        console.log('Calling Anthropic Messages API (streaming):', {
          model: anthropicRequest.model,
          messageCount: messages.length,
          hasSystem: !!systemContent,
        });

        try {
          const response = await callAnthropicAPIStreaming(anthropicApiKey, anthropicRequest);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', response.status, errorText);
            emitter.emit({ type: 'error', error: errorText || 'Anthropic API call failed' });
            emitter.close();
            return;
          }

          const { content: finalContent, usage } = await streamAnthropicResponse(response, emitter);
          
          // Store messages in local table for history reconstruction
          if (threadRowId) {
            await supabase.from('q_prompt_family_messages').insert([
              { thread_row_id: threadRowId, role: 'user', content: user_message },
              { thread_row_id: threadRowId, role: 'assistant', content: finalContent },
            ]);
          }

          // Emit final
          emitter.emit({ type: 'output_text_done', text: finalContent });
          emitter.close();
          return;

        } catch (error) {
          console.error('Anthropic streaming error:', error);
          const message = error instanceof Error ? error.message : 'Anthropic streaming failed';
          emitter.emit({ type: 'error', error: message });
          emitter.close();
          return;
        }
      }
      
      // --- OPENAI PROVIDER (default) ---
      // API call with stale conversation recovery
      let apiResponse: Response;
      let retryAttempted = false;

      // Initial API call
      apiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Handle error with potential retry for stale conversation state
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('Responses API error:', apiResponse.status, errorText);
        
        let parsedError: any = null;
        try { parsedError = JSON.parse(errorText); } catch {}
        
        const upstreamMessage = parsedError?.error?.message || '';
        const isStaleConversation = 
          upstreamMessage.includes('No tool output found') ||
          upstreamMessage.includes('Cannot continue from response') ||
          parsedError?.error?.code === 'invalid_previous_response_id';
        
        // Retry without previous_response_id if stale conversation detected
        if (isStaleConversation && requestBody.previous_response_id && !retryAttempted) {
          console.warn('Detected stale conversation state - clearing and retrying');
          retryAttempted = true;
          
          // Clear stale response_id from database
          await supabase
            .from(TABLES.THREADS)
            .update({ last_response_id: null })
            .eq('row_id', threadRowId);
          
          // Remove from request and retry
          delete requestBody.previous_response_id;
          
          apiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
          
          if (!apiResponse.ok) {
            const retryErrorText = await apiResponse.text();
            console.error('Retry also failed:', retryErrorText);
            let retryUpstreamError = 'AI request failed after retry';
            try {
              const retryParsed = JSON.parse(retryErrorText);
              retryUpstreamError = retryParsed?.error?.message || retryParsed?.message || retryUpstreamError;
            } catch {
              retryUpstreamError = retryErrorText.slice(0, 200);
            }
            emitter.emit({ type: 'error', error: retryUpstreamError, upstream_status: apiResponse.status });
            emitter.close();
            return;
          }
        } else {
          // Not retryable or already retried
          let upstreamError = 'AI request failed';
          try {
            upstreamError = parsedError?.error?.message || parsedError?.message || upstreamError;
          } catch {
            upstreamError = errorText.slice(0, 200);
          }
          
          emitter.emit({ type: 'error', error: upstreamError, upstream_status: apiResponse.status });
          emitter.close();
          return;
        }
      }

      const initialResult = await apiResponse.json();
      let latestResponseId = initialResult.id;
      console.log('Initial response:', latestResponseId, 'status:', initialResult.status);

      // Emit api_started for dashboard
      emitter.emit({ type: 'api_started', response_id: latestResponseId, status: initialResult.status });

      // Handle immediate completion
      let streamResult: { content: string | null; toolCalls: any[]; usage: any | null; status: string };
      
      if (initialResult.status === 'completed') {
        // Extract from initial response
        let content: string | null = null;
        const toolCalls: any[] = [];
        
        if (initialResult.output && Array.isArray(initialResult.output)) {
          for (const item of initialResult.output) {
            if (item.type === 'message' && item.content) {
              for (const contentItem of item.content) {
                if (contentItem.type === 'output_text' && contentItem.text) {
                  content = contentItem.text;
                }
              }
            }
            if (item.type === 'function_call') {
              toolCalls.push(item);
            }
          }
        }
        
      streamResult = { content, toolCalls, usage: initialResult.usage, status: 'completed' };
      
      // Emit content for immediate completion (no streaming occurred)
      if (content) {
        emitter.emit({ type: 'output_text_done', text: content });
      }
    } else if (initialResult.status === 'failed' || initialResult.status === 'cancelled') {
      emitter.emit({ type: 'error', error: `Request ${initialResult.status}` });
      emitter.close();
      return;
    } else {
        // Stream the response
        streamResult = await streamOpenAIResponse(latestResponseId, openAIApiKey, emitter);
      }

      let finalContent = streamResult.content || '';
      let currentToolCalls = streamResult.toolCalls;
      
      // Track if output_text_done has been emitted (prevent duplicates)
      let outputTextDoneEmitted = streamResult.status === 'completed' && !!streamResult.content;

      // Tool execution loop
      const MAX_TOOL_ITERATIONS = 10;
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS && currentToolCalls.length > 0; iteration++) {
        console.log(`Tool iteration ${iteration + 1}: ${currentToolCalls.length} tool(s)`);
        
        const result = await executeToolsAndSubmitStreaming(
          currentToolCalls,
          toolContext,
          latestResponseId,
          selectedModel,
          openAIApiKey,
          emitter,
          modelConfig?.maxOutputTokens
        );
        
        if (result.responseId) {
          latestResponseId = result.responseId;
        }
        
        if (result.content) {
          finalContent = result.content;
        }
        
        if (!result.hasMoreTools) {
          break;
        }
        
        currentToolCalls = result.nextToolCalls;
      }

      emitter.emit({ type: 'tool_loop_complete' });

      // Save response ID for next turn
      if (latestResponseId?.startsWith('resp_')) {
        await updateFamilyThreadResponseId(supabase, threadRowId, latestResponseId);
      }

      console.log('Final content length:', finalContent.length);
      console.log('Output text done already emitted:', outputTextDoneEmitted);

      // Emit final content only if not already emitted (prevents duplicates)
      if (finalContent && !outputTextDoneEmitted) {
        console.log('Emitting output_text_done with text length:', finalContent.length);
        emitter.emit({ type: 'output_text_done', text: finalContent });
      }

      console.log('Closing SSE stream');
      emitter.close();

    } catch (error: unknown) {
      console.error('Error in prompt-family-chat:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      emitter.emit({ type: 'error', error: message });
      emitter.close();
    } finally {
      if (heartbeatInterval !== null) {
        clearInterval(heartbeatInterval);
      }
      emitter.dispose();
    }
  })();

  // Return stream immediately
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});
