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
      thread_row_id, 
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const apiKey = LOVABLE_API_KEY || openAIApiKey;
    const apiEndpoint = LOVABLE_API_KEY 
      ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    
    if (!apiKey) {
      throw new Error('No AI API key configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Build system prompt
    let systemContent = system_prompt || `You are an AI assistant helping the user with their prompt family in Qonsol, a prompt engineering platform.

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

    // Get tools
    const tools = [
      ...getPromptFamilyTools(),
      getQonsolHelpTool()
    ];

    // Build messages array
    const apiMessages = [
      { role: 'system', content: systemContent },
      ...messages
    ];

    console.log('Calling AI with model:', selectedModel, 'tools:', tools.length);

    // Tool handling loop
    const MAX_TOOL_ITERATIONS = 10;
    let currentMessages = [...apiMessages];
    let finalContent = '';
    const toolEvents: Array<{ type: string; tool?: string; args?: any }> = [];
    
    const toolContext = {
      supabase,
      userId: validation.user!.id,
      promptRowId: prompt_row_id,
      familyPromptIds,
      openAIApiKey
    };

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      console.log(`AI call iteration ${iteration + 1}, messages: ${currentMessages.length}`);
      
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
          stream: false
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        
        currentMessages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls
        });

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.error('Failed to parse tool arguments:', toolCall.function.arguments);
          }

          toolEvents.push({ type: 'tool_start', tool: toolName, args: toolArgs });
          
          console.log(`Executing tool: ${toolName}`, toolArgs);
          
          const toolResult = await handleToolCall(toolName, toolArgs, toolContext);
          
          console.log(`Tool ${toolName} result length: ${toolResult.length}`);

          toolEvents.push({ type: 'tool_end', tool: toolName });

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }

        continue;
      }

      // AI returned final content
      finalContent = message.content || '';
      console.log('Final content received, length:', finalContent.length);
      break;
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
