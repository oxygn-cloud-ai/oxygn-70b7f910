import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const { assistant_row_id, user_message, thread_row_id, include_child_context = true } = await req.json();

    if (!assistant_row_id || !user_message) {
      return new Response(
        JSON.stringify({ error: 'assistant_row_id and user_message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Studio chat request:', { assistant_row_id, user: validation.user?.email });

    // Fetch assistant details
    const { data: assistant, error: assistantError } = await supabase
      .from(TABLES.ASSISTANTS)
      .select('*')
      .eq('row_id', assistant_row_id)
      .single();

    if (assistantError || !assistant) {
      console.error('Error fetching assistant:', assistantError);
      return new Response(
        JSON.stringify({ error: 'Assistant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistantData = assistant as any;

    // Build child prompt context if enabled
    let additionalInstructions = '';
    const contextIncluded: string[] = [];

    if (include_child_context && assistantData.prompt_row_id) {
      const { data: childPrompts, error: childError } = await supabase
        .from(TABLES.PROMPTS)
        .select('prompt_name, input_admin_prompt, input_user_prompt, note')
        .eq('parent_row_id', assistantData.prompt_row_id)
        .eq('is_deleted', false)
        .order('position', { ascending: true });

      if (!childError && childPrompts && childPrompts.length > 0) {
        const contextParts: string[] = [];
        
        for (const child of childPrompts) {
          const parts: string[] = [];
          if (child.input_admin_prompt) parts.push(`System: ${child.input_admin_prompt}`);
          if (child.input_user_prompt) parts.push(`User Template: ${child.input_user_prompt}`);
          if (child.note) parts.push(`Notes: ${child.note}`);
          
          if (parts.length > 0) {
            contextParts.push(`=== ${child.prompt_name} ===\n${parts.join('\n')}`);
            contextIncluded.push(child.prompt_name);
          }
        }

        if (contextParts.length > 0) {
          additionalInstructions = `\n\nContext from related prompts:\n${contextParts.join('\n\n')}`;
        }
      }
    }

    console.log('Context included from child prompts:', contextIncluded);

    // Track conversation via previous_response_id
    let previousResponseId: string | null = null;
    let threadRowId: string | null = null;

    // Look for existing Studio thread
    const { data: existingThread } = await supabase
      .from(TABLES.THREADS)
      .select('row_id, last_response_id')
      .eq('assistant_row_id', assistant_row_id)
      .is('child_prompt_row_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (thread_row_id) {
      // Use specified thread
      const { data: specifiedThread } = await supabase
        .from(TABLES.THREADS)
        .select('row_id, last_response_id')
        .eq('row_id', thread_row_id)
        .single();

      if (specifiedThread) {
        previousResponseId = specifiedThread.last_response_id;
        threadRowId = specifiedThread.row_id;
      }
    } else if (existingThread) {
      previousResponseId = existingThread.last_response_id;
      threadRowId = existingThread.row_id;
    }

    const modelId = assistantData.model_override || 'gpt-4o';

    // Build tools array
    const tools = getAllTools({
      codeInterpreterEnabled: assistantData.code_interpreter_enabled || false,
      fileSearchEnabled: assistantData.file_search_enabled || false,
      confluenceEnabled: assistantData.confluence_enabled || false,
      vectorStoreIds: assistantData.vector_store_id ? [assistantData.vector_store_id] : undefined,
    });

    // Build input
    const input: any[] = [];
    
    // System instructions with additional context
    let systemContent = assistantData.instructions || 'You are a helpful assistant.';
    if (additionalInstructions) {
      systemContent += additionalInstructions;
    }
    input.push({ role: 'system', content: systemContent });
    input.push({ role: 'user', content: user_message });

    const requestBody: any = {
      model: modelId,
      input,
      tools: tools.length > 0 ? tools : undefined,
    };

    if (previousResponseId) {
      requestBody.previous_response_id = previousResponseId;
      console.log('Using previous_response_id for continuation:', previousResponseId);
    }

    // Add model parameters
    const temperature = assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined;
    if (temperature !== undefined && !isNaN(temperature)) requestBody.temperature = temperature;

    console.log('Calling Responses API for Studio chat:', { model: modelId, toolCount: tools.length });

    // Call Responses API
    let response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Responses API error:', error);
      return new Response(
        JSON.stringify({ error: error.error?.message || 'Responses API call failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData = await response.json();

    // Handle function calls
    let maxIterations = 10;
    let iteration = 0;

    while (hasFunctionCalls(responseData.output) && iteration < maxIterations) {
      iteration++;
      console.log(`Processing function calls, iteration ${iteration}`);

      const functionCallOutputs: any[] = [];

      for (const item of responseData.output || []) {
        if (item.type === 'function_call') {
          const functionName = item.name;
          const args = typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments;
          
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

      // Continue with function outputs
      const continueBody: any = {
        model: modelId,
        previous_response_id: responseData.id,
        input: functionCallOutputs,
        tools: tools.length > 0 ? tools : undefined,
      };

      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(continueBody),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Responses API continuation error:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to continue after function call' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      responseData = await response.json();
    }

    // Extract response text
    const responseText = extractTextFromResponseOutput(responseData.output);

    // Create or update thread record
    if (threadRowId) {
      await supabase
        .from(TABLES.THREADS)
        .update({
          last_response_id: responseData.id,
          last_message_at: new Date().toISOString(),
        })
        .eq('row_id', threadRowId);
    } else {
      const { data: newThread } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id: assistant_row_id,
          child_prompt_row_id: null,
          openai_thread_id: `local_${Date.now()}`,
          last_response_id: responseData.id,
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
        })
        .select()
        .single();

      threadRowId = newThread?.row_id || null;
    }

    // Store messages
    if (threadRowId) {
      await supabase.from('q_thread_messages').insert({
        thread_row_id: threadRowId,
        role: 'user',
        content: user_message,
        owner_id: validation.user?.id,
      });

      await supabase.from('q_thread_messages').insert({
        thread_row_id: threadRowId,
        role: 'assistant',
        content: responseText,
        response_id: responseData.id,
        owner_id: validation.user?.id,
      });
    }

    console.log('Studio chat completed');

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        response_id: responseData.id,
        thread_row_id: threadRowId,
        context_included: contextIncluded,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in studio-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
