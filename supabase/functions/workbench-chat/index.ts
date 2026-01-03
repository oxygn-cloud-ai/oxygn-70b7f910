import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchActiveModels, resolveApiModelId, getDefaultModelFromSettings } from "../_shared/models.ts";
import { loadQonsolKnowledge, getQonsolHelpTool, handleQonsolHelpToolCall } from "../_shared/knowledge.ts";
import { getGithubTools, handleGithubToolCall } from "../_shared/github.ts";

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
    return { valid: false, error: 'Access denied. Only chocfin.com and oxygn.cloud accounts are allowed.' };
  }

  return { valid: true, user, supabase };
}

// Tool definitions for workbench
function getWorkbenchTools(config: {
  hasPrompts: boolean;
  hasLibrary: boolean;
  hasConfluence: boolean;
  hasFiles: boolean;
  hasKnowledge: boolean;
  hasGithub: boolean;
}) {
  const tools: any[] = [];

  // Qonsol Help tool
  if (config.hasKnowledge) {
    tools.push(getQonsolHelpTool());
  }

  // Prompt tools - Using Responses API flat format (name at top level)
  if (config.hasPrompts) {
    tools.push({
      type: "function",
      name: "list_prompts",
      description: "List all prompts in the project tree with their names and IDs. Use this to discover available prompts before executing them.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
      }
    });

    tools.push({
      type: "function",
      name: "get_prompt_details",
      description: "Get detailed information about a specific prompt including its system prompt, user prompt template, and variables.",
      parameters: {
        type: "object",
        properties: {
          prompt_row_id: {
            type: "string",
            description: "The row_id of the prompt to retrieve"
          }
        },
        required: ["prompt_row_id"],
        additionalProperties: false
      }
    });

    tools.push({
      type: "function",
      name: "execute_prompt",
      description: "Execute a prompt with optional variable substitutions and return the AI response.",
      parameters: {
        type: "object",
        properties: {
          prompt_row_id: {
            type: "string",
            description: "The row_id of the prompt to execute"
          },
          variables: {
            type: "object",
            description: "Key-value pairs to substitute in the prompt template",
            additionalProperties: { type: "string" }
          }
        },
        required: ["prompt_row_id"],
        additionalProperties: false
      }
    });
  }

  // Library tools - Using Responses API flat format
  if (config.hasLibrary) {
    tools.push({
      type: "function",
      name: "list_library",
      description: "List all items in the user's prompt library including shared items.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Optional category to filter by"
          }
        },
        required: [],
        additionalProperties: false
      }
    });

    tools.push({
      type: "function",
      name: "get_library_item",
      description: "Get the full content of a library item by its ID.",
      parameters: {
        type: "object",
        properties: {
          row_id: {
            type: "string",
            description: "The row_id of the library item"
          }
        },
        required: ["row_id"],
        additionalProperties: false
      }
    });
  }

  // Confluence tools - Using Responses API flat format
  if (config.hasConfluence) {
    tools.push({
      type: "function",
      name: "confluence_list_attached",
      description: "List all Confluence pages attached to this workbench thread.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
      }
    });

    tools.push({
      type: "function",
      name: "confluence_read_attached",
      description: "Read the content of an attached Confluence page.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The Confluence page ID"
          }
        },
        required: ["page_id"],
        additionalProperties: false
      }
    });
  }

  // File tools - Using Responses API flat format
  if (config.hasFiles) {
    tools.push({
      type: "function",
      name: "list_files",
      description: "List all files attached to this workbench thread.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
      }
    });
  }

  // GitHub repository tools
  if (config.hasGithub) {
    tools.push(...getGithubTools());
  }

  // Database schema tool - always available, using Responses API flat format
  tools.push({
    type: "function",
    name: "get_database_schema",
    description: "Get the database schema for Qonsol tables. Returns table names, columns, types, and relationships. Use this to understand the data model.",
    parameters: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Optional specific table name to get details for. If not provided, returns all q_* tables."
        }
      },
      required: [],
      additionalProperties: false
    }
  });

  return tools;
}

// Handle tool calls
async function handleToolCall(
  toolName: string,
  args: any,
  context: {
    supabase: any;
    userId: string;
    threadRowId: string;
    openAIApiKey: string;
    githubToken?: string;
    githubOwner?: string;
    githubRepo?: string;
  }
): Promise<string> {
  const { supabase, userId, threadRowId, openAIApiKey, githubToken, githubOwner, githubRepo } = context;

  try {
    switch (toolName) {
      case 'list_prompts': {
        // Filter by owner_id for multi-tenant segregation
        const { data: prompts, error } = await supabase
          .from('q_prompts')
          .select('row_id, prompt_name, parent_row_id, note')
          .eq('is_deleted', false)
          .eq('owner_id', userId)
          .order('position', { ascending: true });

        if (error) throw error;

        return JSON.stringify({
          message: `Found ${prompts?.length || 0} prompts`,
          prompts: prompts?.map((p: any) => ({
            row_id: p.row_id,
            name: p.prompt_name,
            parent_id: p.parent_row_id,
            note: p.note
          })) || []
        });
      }

      case 'get_prompt_details': {
        const { prompt_row_id } = args;
        // Verify ownership for multi-tenant segregation
        const { data: prompt, error } = await supabase
          .from('q_prompts')
          .select('*')
          .eq('row_id', prompt_row_id)
          .eq('owner_id', userId)
          .single();

        if (error) throw error;
        if (!prompt) return JSON.stringify({ error: 'Prompt not found or access denied' });

        // Get variables
        const { data: variables } = await supabase
          .from('q_prompt_variables')
          .select('variable_name, variable_value, variable_description, is_required')
          .eq('prompt_row_id', prompt_row_id);

        return JSON.stringify({
          name: prompt.prompt_name,
          system_prompt: prompt.input_admin_prompt,
          user_prompt: prompt.input_user_prompt,
          model: prompt.model,
          note: prompt.note,
          variables: variables || []
        });
      }

      case 'execute_prompt': {
        const { prompt_row_id, variables = {} } = args;
        
        // Verify ownership for multi-tenant segregation
        const { data: prompt, error } = await supabase
          .from('q_prompts')
          .select('*')
          .eq('row_id', prompt_row_id)
          .eq('owner_id', userId)
          .single();

        if (error || !prompt) {
          return JSON.stringify({ error: 'Prompt not found or access denied' });
        }

        // Get prompt variables for substitution
        const { data: promptVars } = await supabase
          .from('q_prompt_variables')
          .select('variable_name, variable_value')
          .eq('prompt_row_id', prompt_row_id);

        // Build variable map
        const varMap: Record<string, string> = {};
        for (const v of promptVars || []) {
          varMap[v.variable_name] = variables[v.variable_name] || v.variable_value || '';
        }

        // Substitute variables in prompts
        let systemPrompt = prompt.input_admin_prompt || '';
        let userPrompt = prompt.input_user_prompt || '';

        for (const [key, value] of Object.entries(varMap)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          systemPrompt = systemPrompt.replace(regex, value);
          userPrompt = userPrompt.replace(regex, value);
        }

        // Build messages array
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        if (userPrompt) messages.push({ role: 'user', content: userPrompt });

        // Call OpenAI with model from DB or prompt setting
        const promptModel = prompt.model || (await getDefaultModelFromSettings(supabase));
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: promptModel,
            messages,
            max_tokens: prompt.max_tokens ? parseInt(prompt.max_tokens) : undefined,
            temperature: prompt.temperature ? parseFloat(prompt.temperature) : undefined,
          })
        });

        if (!response.ok) {
          const err = await response.json();
          return JSON.stringify({ error: err.error?.message || 'Failed to execute prompt' });
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '';

        return JSON.stringify({
          prompt_name: prompt.prompt_name,
          response: content,
          model: result.model,
          usage: result.usage
        });
      }

      case 'list_library': {
        const { category } = args;
        // Include own items, system items (is_system=true), and public items (is_private=false)
        let query = supabase
          .from('q_prompt_library')
          .select('row_id, name, description, category, is_private, owner_id, is_system, contributor_display_name')
          .or(`owner_id.eq.${userId},is_system.eq.true,is_private.eq.false`)
          .order('name', { ascending: true });

        if (category) {
          query = query.eq('category', category);
        }

        const { data: items, error } = await query;
        if (error) throw error;

        return JSON.stringify({
          message: `Found ${items?.length || 0} library items`,
          items: items || []
        });
      }

      case 'get_library_item': {
        const { row_id } = args;
        const { data: item, error } = await supabase
          .from('q_prompt_library')
          .select('*')
          .eq('row_id', row_id)
          .or(`owner_id.eq.${userId},is_private.eq.false`)
          .single();

        if (error || !item) {
          return JSON.stringify({ error: 'Library item not found or not accessible' });
        }

        return JSON.stringify({
          name: item.name,
          content: item.content,
          description: item.description,
          category: item.category
        });
      }

      case 'confluence_list_attached': {
        const { data: pages, error } = await supabase
          .from('q_workbench_confluence_links')
          .select('row_id, page_id, page_title, page_url, sync_status')
          .eq('thread_row_id', threadRowId);

        if (error) throw error;

        return JSON.stringify({
          message: `${pages?.length || 0} Confluence pages attached`,
          pages: pages || []
        });
      }

      case 'confluence_read_attached': {
        const { page_id } = args;
        const { data: page, error } = await supabase
          .from('q_workbench_confluence_links')
          .select('page_id, page_title, content_text, page_url')
          .eq('thread_row_id', threadRowId)
          .eq('page_id', page_id)
          .single();

        if (error || !page) {
          return JSON.stringify({ error: 'Page not found or not attached to this thread' });
        }

        return JSON.stringify({
          title: page.page_title,
          content: page.content_text || '(Content not synced yet)',
          url: page.page_url
        });
      }

      case 'list_files': {
        const { data: files, error } = await supabase
          .from('q_workbench_files')
          .select('row_id, original_filename, mime_type, file_size, upload_status')
          .eq('thread_row_id', threadRowId);

        if (error) throw error;

        return JSON.stringify({
          message: `${files?.length || 0} files attached`,
          files: files || []
        });
      }

      case 'search_qonsol_help': {
        return await handleQonsolHelpToolCall(args, supabase);
      }

      // GitHub tools
      case 'github_list_files':
      case 'github_read_file':
      case 'github_search_code':
      case 'github_get_structure': {
        if (!githubToken || !githubOwner || !githubRepo) {
          return JSON.stringify({ error: 'GitHub integration not configured' });
        }
        return await handleGithubToolCall(toolName, args, githubToken, githubOwner, githubRepo);
      }

      case 'get_database_schema': {
        const { table_name } = args;
        
        // Query information_schema for column details
        let columnsQuery = supabase
          .from('information_schema.columns' as any)
          .select('table_name, column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public');
        
        if (table_name) {
          columnsQuery = columnsQuery.eq('table_name', table_name);
        } else {
          columnsQuery = columnsQuery.like('table_name', 'q_%');
        }
        
        const { data: columns, error: columnsError } = await columnsQuery;
        
        if (columnsError) {
          // Fallback: use a direct RPC or simpler approach
          // Get tables from our known schema
          const knownTables = [
            'q_prompts', 'q_prompt_variables', 'q_prompt_library',
            'q_assistants', 'q_assistant_files', 'q_threads',
            'q_templates', 'q_json_schema_templates', 'q_export_templates',
            'q_confluence_pages', 'q_models', 'q_model_defaults',
            'q_settings', 'q_ai_costs', 'q_app_knowledge',
            'q_workbench_threads', 'q_workbench_messages', 'q_workbench_files',
            'q_workbench_confluence_links', 'q_vector_stores',
            'q_prompt_family_threads', 'q_prompt_family_messages',
            'profiles', 'projects', 'resource_shares', 'user_roles'
          ];
          
          if (table_name) {
            // Get sample row to infer columns
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
        
        // Group columns by table
        const schema: Record<string, any[]> = {};
        for (const col of columns || []) {
          if (!schema[col.table_name]) {
            schema[col.table_name] = [];
          }
          schema[col.table_name].push({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            default: col.column_default
          });
        }
        
        return JSON.stringify({
          tables: Object.keys(schema),
          schema,
          count: Object.keys(schema).length
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = await validateUser(req);
    if (!validation.valid) {
      console.error('Auth validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Workbench chat request from:', validation.user?.email);

    const { thread_row_id, messages, system_prompt, model } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Use Lovable AI or OpenAI
    const apiKey = LOVABLE_API_KEY || openAIApiKey;
    const apiEndpoint = LOVABLE_API_KEY 
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    
    if (!apiKey) {
      throw new Error('No AI API key configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get default model from settings or DB
    let selectedModel = model;
    if (!selectedModel) {
      const { data: modelSetting } = await supabase
        .from('q_settings')
        .select('setting_value')
        .eq('setting_key', 'workbench_default_model')
        .single();
      if (modelSetting?.setting_value) {
        selectedModel = modelSetting.setting_value;
      } else {
        // Fall back to first active model from DB
        selectedModel = await getDefaultModelFromSettings(supabase);
      }
    }

    // Get system prompt from settings if not provided
    let systemContent = system_prompt;
    if (!systemContent) {
      const { data: promptSetting } = await supabase
        .from('q_settings')
        .select('setting_value')
        .eq('setting_key', 'workbench_system_prompt')
        .single();
      systemContent = promptSetting?.setting_value || 'You are a helpful AI assistant for the Qonsol prompt engineering workbench. You can help users explore prompts, access their library, and work with attached documents.';
    }

    // Check what resources are available
    const hasThread = !!thread_row_id;
    
    // GitHub configuration from environment variables (infrastructure-only)
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const githubOwner = Deno.env.get('GITHUB_OWNER');
    const githubRepo = Deno.env.get('GITHUB_REPO');
    const hasGithub = !!(githubToken && githubOwner && githubRepo);
    
    if (hasGithub) {
      console.log('[workbench-chat] GitHub configured:', githubOwner, '/', githubRepo);
    } else {
      console.log('[workbench-chat] GitHub not configured - token:', !!githubToken, 'owner:', !!githubOwner, 'repo:', !!githubRepo);
    }
    
    // Load Qonsol knowledge for the system prompt
    const knowledge = await loadQonsolKnowledge(supabase, ['overview', 'prompts', 'workbench', 'troubleshooting']);
    
    // Get tool configuration
    const tools = getWorkbenchTools({
      hasPrompts: true,
      hasLibrary: true,
      hasConfluence: hasThread,
      hasFiles: hasThread,
      hasKnowledge: true,
      hasGithub
    });

    // Build messages array with system prompt including knowledge
    const enhancedSystemContent = `${systemContent}

## Qonsol Knowledge Base
${knowledge}

Use the search_qonsol_help tool to find more specific information about Qonsol features.`;

    const apiMessages = [
      { role: 'system', content: enhancedSystemContent },
      ...messages
    ];

    console.log('Calling AI with model:', selectedModel, 'tools:', tools.length);

    // Tool handling loop - execute tools until we get a final content response
    const MAX_TOOL_ITERATIONS = 10;
    let currentMessages = [...apiMessages];
    let finalContent = '';
    const toolEvents: Array<{ type: string; tool?: string; args?: any }> = [];
    
    const toolContext = {
      supabase,
      userId: validation.user!.id,
      threadRowId: thread_row_id || '',
      openAIApiKey: openAIApiKey || '',
      githubToken: githubToken || undefined,
      githubOwner,
      githubRepo
    };

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      console.log(`AI call iteration ${iteration + 1}, messages: ${currentMessages.length}`);
      
      // Make non-streaming request to check for tool calls
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          stream: false  // Non-streaming for tool detection
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI request failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      
      if (!choice) {
        console.error('No choice in AI response:', result);
        return new Response(
          JSON.stringify({ error: 'Invalid AI response' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const message = choice.message;
      const finishReason = choice.finish_reason;

      console.log('AI response - finish_reason:', finishReason, 'has_tool_calls:', !!message.tool_calls);

      // Check if AI wants to call tools
      if (finishReason === 'tool_calls' && message.tool_calls && message.tool_calls.length > 0) {
        console.log(`Executing ${message.tool_calls.length} tool call(s)`);
        
        // Add assistant message with tool calls to conversation
        currentMessages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls
        });

        // Execute each tool and add results
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.error('Failed to parse tool arguments:', toolCall.function.arguments);
          }

          // Record tool start event
          toolEvents.push({ type: 'tool_start', tool: toolName, args: toolArgs });
          
          console.log(`Executing tool: ${toolName}`, toolArgs);
          
          const toolResult = await handleToolCall(toolName, toolArgs, toolContext);
          
          console.log(`Tool ${toolName} result length: ${toolResult.length}`);

          // Record tool end event
          toolEvents.push({ type: 'tool_end', tool: toolName });

          // Add tool result to messages
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }

        // Continue loop - AI will process tool results
        continue;
      }

      // AI returned final content (no more tool calls)
      finalContent = message.content || '';
      console.log('Final content received, length:', finalContent.length);
      break;
    }

    // Record tool loop complete
    if (toolEvents.length > 0) {
      toolEvents.push({ type: 'tool_loop_complete' });
    }

    // Stream the response back as SSE format for client compatibility
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // First send all tool events
        for (const event of toolEvents) {
          const sseData = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        }
        
        // Then send the final content as a single SSE event in OpenAI streaming format
        const contentData = JSON.stringify({
          choices: [{
            delta: { content: finalContent },
            finish_reason: 'stop'
          }]
        });
        controller.enqueue(encoder.encode(`data: ${contentData}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: unknown) {
    console.error('Error in workbench-chat:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
