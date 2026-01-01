import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDefaultModelFromSettings } from "../_shared/models.ts";
import { loadQonsolKnowledge, getQonsolHelpTool, handleQonsolHelpToolCall } from "../_shared/knowledge.ts";
import { 
  getPromptFamilyTree, 
  getFamilyPromptIds, 
  getFamilyFiles, 
  getFamilyConfluencePages, 
  getFamilyJsonSchemas,
  getFamilyVariables,
  getPromptFamilySummary,
  getPromptFamilyTools
} from "../_shared/promptFamily.ts";
import { TABLES } from "../_shared/tables.ts";
import { resolveRootPromptId, getOrCreateFamilyThread, updateFamilyThreadResponse } from "../_shared/familyThreads.ts";

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
    return { valid: false, error: 'Access denied' };
  }

  return { valid: true, user, supabase };
}

// Handle tool calls for prompt family exploration
async function handleToolCall(
  toolName: string,
  args: any,
  context: {
    supabase: any;
    userId: string;
    promptRowId: string;
    familyPromptIds: string[];
    openAIApiKey?: string;
  }
): Promise<string> {
  const { supabase, promptRowId, familyPromptIds, openAIApiKey } = context;

  try {
    switch (toolName) {
      case 'get_prompt_tree': {
        const tree = await getPromptFamilyTree(supabase, promptRowId);
        return JSON.stringify({
          message: 'Prompt family tree',
          tree
        });
      }

      case 'get_prompt_details': {
        const { prompt_row_id } = args;
        
        // Verify prompt is in this family
        if (!familyPromptIds.includes(prompt_row_id)) {
          return JSON.stringify({ error: 'Prompt not in this family' });
        }

        const { data: prompt, error } = await supabase
          .from(TABLES.PROMPTS)
          .select('*')
          .eq('row_id', prompt_row_id)
          .single();

        if (error || !prompt) {
          return JSON.stringify({ error: 'Prompt not found' });
        }

        // Get variables
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
        
        // Group by prompt
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
        
        // Known Qonsol tables
        const knownTables = [
          'q_prompts', 'q_prompt_variables', 'q_prompt_library',
          'q_assistants', 'q_assistant_files', 'q_threads',
          'q_templates', 'q_json_schema_templates', 'q_export_templates',
          'q_confluence_pages', 'q_models', 'q_model_defaults',
          'q_settings', 'q_ai_costs', 'q_app_knowledge',
          'q_workbench_threads', 'q_workbench_messages', 'q_workbench_files',
          'q_workbench_confluence_links', 'q_vector_stores',
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

    console.log('Prompt family chat request from:', validation.user?.email);

    const { 
      prompt_row_id,
      messages, 
      system_prompt, 
      model 
    } = await req.json();

    if (!prompt_row_id) {
      return new Response(
        JSON.stringify({ error: 'prompt_row_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!openAIApiKey) {
      throw new Error('No OpenAI API key configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify ownership of the prompt for multi-tenant segregation
    const { data: promptCheck, error: promptCheckError } = await supabase
      .from(TABLES.PROMPTS)
      .select('owner_id')
      .eq('row_id', prompt_row_id)
      .single();

    if (promptCheckError || !promptCheck) {
      return new Response(
        JSON.stringify({ error: 'Prompt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (promptCheck.owner_id !== validation.user?.id) {
      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: validation.user?.id });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Access denied - you do not own this prompt' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================================================
    // UNIFIED FAMILY THREAD RESOLUTION
    // Chat panel shares the same thread as prompt runs
    // ============================================================================
    const rootPromptRowId = await resolveRootPromptId(supabase, prompt_row_id);
    console.log('Resolved root prompt for chat:', rootPromptRowId, 'from:', prompt_row_id);

    // Get or create the unified family thread
    const familyThread = await getOrCreateFamilyThread(
      supabase,
      rootPromptRowId,
      validation.user!.id,
      'Chat'
    );

    console.log('Using unified family thread:', {
      thread_row_id: familyThread.row_id,
      previous_response_id: familyThread.last_response_id,
      thread_created: familyThread.created,
    });

    // Get prompt family info
    const familyPromptIds = await getFamilyPromptIds(supabase, prompt_row_id);
    const familySummary = await getPromptFamilySummary(supabase, prompt_row_id);
    
    // Load Qonsol knowledge for relevant topics
    const knowledge = await loadQonsolKnowledge(supabase, [
      'overview', 'prompts', 'variables', 'cascade', 'json_schemas', 'actions', 'troubleshooting'
    ], 6000);

    // Get default model from settings
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
        selectedModel = await getDefaultModelFromSettings(supabase);
      }
    }

    // Build system prompt with chat-specific tools (NOT available to prompt runs)
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

    // Get tools (chat-specific - NOT available to prompt runs)
    // Uses Responses API format (flat structure with name at top level)
    const databaseSchemaTool = {
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
    // strict: true removed - incompatible with optional parameters
  };

    const tools = [
      ...getPromptFamilyTools(),
      getQonsolHelpTool(),
      databaseSchemaTool
    ];

    // Build the user message (last message in array)
    const lastUserMessage = messages[messages.length - 1];
    const userInput = lastUserMessage?.content || '';

    const toolContext = {
      supabase,
      userId: validation.user!.id,
      promptRowId: prompt_row_id,
      familyPromptIds,
      openAIApiKey
    };

    // ============================================================================
    // RESPONSES API with conversation chaining via previous_response_id
    // This shares conversation memory with prompt runs
    // ============================================================================
    const MAX_TOOL_ITERATIONS = 10;
    let previousResponseId = familyThread.last_response_id;
    let finalContent = '';
    const toolEvents: Array<{ type: string; tool?: string; args?: any }> = [];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      console.log(`AI call iteration ${iteration + 1}, previous_response_id:`, previousResponseId);
      
      // Build Responses API request
      const requestBody: any = {
        model: selectedModel,
        input: userInput,
        instructions: systemContent,
        tools: tools.length > 0 ? tools : undefined,
        store: true, // Store for conversation chaining
      };

      // Chain with previous response for conversation memory
      if (previousResponseId) {
        requestBody.previous_response_id = previousResponseId;
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('Responses API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI request failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await response.json();
      console.log('Responses API result - id:', result.id, 'status:', result.status);

      // Update previousResponseId for next iteration or final storage
      previousResponseId = result.id;

      // Check for tool calls in output
      const toolCalls = result.output?.filter((item: any) => item.type === 'function_call') || [];
      
      if (toolCalls.length > 0) {
        console.log(`Executing ${toolCalls.length} tool call(s)`);
        
        // Process tool calls
        const toolResults: any[] = [];
        for (const toolCall of toolCalls) {
          const toolName = toolCall.name;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolCall.arguments || '{}');
          } catch (e) {
            console.error('Failed to parse tool arguments:', toolCall.arguments);
          }

          toolEvents.push({ type: 'tool_start', tool: toolName, args: toolArgs });
          
          console.log(`Executing tool: ${toolName}`, toolArgs);
          
          const toolResult = await handleToolCall(toolName, toolArgs, toolContext);
          
          console.log(`Tool ${toolName} result length: ${toolResult.length}`);

          toolEvents.push({ type: 'tool_end', tool: toolName });

          toolResults.push({
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: toolResult
          });
        }

        // Submit tool results back to the API
        const toolSubmitResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            previous_response_id: previousResponseId,
            input: toolResults,
            store: true,
          })
        });

        if (!toolSubmitResponse.ok) {
          const errorText = await toolSubmitResponse.text();
          console.error('Tool submit error:', toolSubmitResponse.status, errorText);
          break;
        }

        const toolSubmitResult = await toolSubmitResponse.json();
        previousResponseId = toolSubmitResult.id;

        // Extract content from tool submission result
        const outputContent = toolSubmitResult.output?.find((item: any) => item.type === 'message');
        if (outputContent?.content) {
          for (const contentItem of outputContent.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              finalContent = contentItem.text;
            }
          }
        }

        // Check if more tool calls needed
        const moreToolCalls = toolSubmitResult.output?.filter((item: any) => item.type === 'function_call') || [];
        if (moreToolCalls.length === 0) {
          break;
        }
        continue;
      }

      // Extract final content from response
      const outputMessage = result.output?.find((item: any) => item.type === 'message');
      if (outputMessage?.content) {
        for (const contentItem of outputMessage.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            finalContent = contentItem.text;
          }
        }
      }
      
      console.log('Final content received, length:', finalContent.length);
      break;
    }

    // Update family thread with final response ID for conversation chaining
    if (previousResponseId) {
      await updateFamilyThreadResponse(supabase, familyThread.row_id, previousResponseId);
    }

    if (toolEvents.length > 0) {
      toolEvents.push({ type: 'tool_loop_complete' });
    }

    // Stream response back as SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const event of toolEvents) {
          const sseData = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        }
        
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
    console.error('Error in prompt-family-chat:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
