import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TABLES, FK } from "../_shared/tables.ts";

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

// Poll for run completion with function call handling
async function waitForRunCompletion(
  threadId: string,
  runId: string,
  apiKey: string,
  supabase: any,
  maxAttempts = 120,
  intervalMs = 1000
): Promise<{ status: string; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error checking run status:', errorText);
      return { status: 'error', error: errorText };
    }

    const run = await response.json();
    console.log(`Run status (attempt ${attempt + 1}):`, run.status);

    if (run.status === 'completed') {
      return { status: 'completed' };
    }
    if (run.status === 'failed') {
      return { status: 'failed', error: run.last_error?.message || 'Run failed' };
    }
    if (run.status === 'cancelled') {
      return { status: 'cancelled', error: 'Run was cancelled' };
    }
    if (run.status === 'expired') {
      return { status: 'expired', error: 'Run expired' };
    }

    // Handle function calls (requires_action)
    if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
      console.log('Processing tool calls:', toolCalls.length);

      const toolOutputs = [];
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log('Executing tool:', functionName, args);

        let output: string;
        if (functionName.startsWith('confluence_')) {
          output = await handleConfluenceTool(functionName, args, supabase);
        } else {
          output = JSON.stringify({ error: `Unknown function: ${functionName}` });
        }

        toolOutputs.push({
          tool_call_id: toolCall.id,
          output,
        });
      }

      // Submit tool outputs
      const submitResponse = await fetch(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({ tool_outputs: toolOutputs }),
        }
      );

      if (!submitResponse.ok) {
        const error = await submitResponse.json();
        console.error('Failed to submit tool outputs:', error);
        return { status: 'error', error: 'Failed to submit tool outputs' };
      }

      console.log('Submitted tool outputs, continuing...');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { status: 'timeout', error: 'Run timed out waiting for completion' };
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

    if (!assistantData.openai_assistant_id || assistantData.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Assistant is not instantiated. Please instantiate it first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch assistant files separately
    const { data: assistantFiles } = await supabase
      .from(TABLES.ASSISTANT_FILES)
      .select('*')
      .eq('assistant_row_id', assistantData.row_id);

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

    // Handle thread creation or reuse
    let openaiThreadId: string;
    let threadRowId: string;

    if (thread_row_id) {
      // Fetch existing thread
      const { data: existingThread, error: threadError } = await supabase
        .from(TABLES.THREADS)
        .select('*')
        .eq('row_id', thread_row_id)
        .single();

      if (threadError || !existingThread) {
        return new Response(
          JSON.stringify({ error: 'Thread not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      openaiThreadId = existingThread.openai_thread_id;
      threadRowId = existingThread.row_id;
    } else {
      // Create new thread in OpenAI
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({}),
      });

      if (!threadResponse.ok) {
        const errorText = await threadResponse.text();
        console.error('Error creating thread:', errorText);
        throw new Error(`Failed to create thread: ${errorText}`);
      }

      const thread = await threadResponse.json();
      openaiThreadId = thread.id;

      // Save thread to database (Studio threads have child_prompt_row_id = NULL)
      const { data: newThread, error: insertError } = await supabase
        .from(TABLES.THREADS)
        .insert({
          openai_thread_id: openaiThreadId,
          assistant_row_id: assistant_row_id,
          child_prompt_row_id: null, // Studio thread - not tied to a child prompt
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving thread:', insertError);
        throw new Error('Failed to save thread to database');
      }

      threadRowId = newThread.row_id;
    }

    // Build file attachments from uploaded files
    const files = assistantFiles || [];
    const uploadedFiles = files.filter((f: any) => f.openai_file_id && f.upload_status === 'uploaded');
    
    const attachments = uploadedFiles.map((f: any) => ({
      file_id: f.openai_file_id,
      tools: [{ type: 'file_search' }],
    }));

    console.log('Attaching files to message:', attachments.length);

    // Add message to thread with file attachments
    const messageBody: any = {
      role: 'user',
      content: user_message,
    };
    
    if (attachments.length > 0) {
      messageBody.attachments = attachments;
    }

    const messageResponse = await fetch(
      `https://api.openai.com/v1/threads/${openaiThreadId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(messageBody),
      }
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Error adding message:', errorText);
      throw new Error(`Failed to add message: ${errorText}`);
    }

    // Create run with additional instructions from child prompts
    const runBody: Record<string, unknown> = {
      assistant_id: assistantData.openai_assistant_id,
    };

    if (additionalInstructions) {
      runBody.additional_instructions = additionalInstructions;
    }

    const runResponse = await fetch(
      `https://api.openai.com/v1/threads/${openaiThreadId}/runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(runBody),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Error creating run:', errorText);
      throw new Error(`Failed to create run: ${errorText}`);
    }

    const run = await runResponse.json();
    console.log('Run created:', run.id);

    // Wait for completion with tool handling
    const completion = await waitForRunCompletion(openaiThreadId, run.id, openAIApiKey, supabase);

    if (completion.status !== 'completed') {
      return new Response(
        JSON.stringify({
          error: `Run ${completion.status}: ${completion.error || 'Unknown error'}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the assistant's response
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${openaiThreadId}/messages?limit=1&order=desc`,
      {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      }
    );

    if (!messagesResponse.ok) {
      throw new Error('Failed to fetch response message');
    }

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data[0];
    
    let responseText = '';
    if (assistantMessage?.content) {
      for (const content of assistantMessage.content) {
        if (content.type === 'text') {
          responseText += content.text.value;
        }
      }
    }

    // Update thread metadata
    await supabase
      .from(TABLES.THREADS)
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('row_id', threadRowId);

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        thread_id: openaiThreadId,
        thread_row_id: threadRowId,
        run_id: run.id,
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