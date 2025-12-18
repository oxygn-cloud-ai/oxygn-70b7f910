import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    .from('cyg_settings')
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
        content: contentText.substring(0, 15000), // Limit content size
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
  for (let i = 0; i < maxAttempts; i++) {
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
      return { status: 'error', error: 'Failed to check run status' };
    }

    const run = await response.json();
    console.log('Run status:', run.status);

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
      // Continue polling after submitting tool outputs
    }

    // Still in progress - wait and retry
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { status: 'timeout', error: 'Run timed out' };
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

    console.log('Assistant run request:', { child_prompt_row_id, user: validation.user?.email, requestStrategy });

    // Fetch child prompt with parent info
    const { data: childPrompt, error: promptError } = await supabase
      .from('cyg_prompts')
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
      .from('cyg_prompts')
      .select('is_assistant')
      .eq('row_id', parentRowId)
      .single();

    if (!parentPrompt?.is_assistant) {
      return new Response(
        JSON.stringify({ error: 'Parent is not an assistant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch assistant config with files
    const { data: assistant, error: assistantError } = await supabase
      .from('cyg_assistants')
      .select('*, cyg_assistant_files(*)')
      .eq('prompt_row_id', parentRowId)
      .single();

    if (assistantError || !assistant) {
      return new Response(
        JSON.stringify({ error: 'Assistant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!assistant.openai_assistant_id || assistant.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Assistant is not active. Please instantiate first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch attached Confluence pages for context injection
    const { data: confluencePages } = await supabase
      .from('cyg_confluence_pages')
      .select('page_title, content_text, openai_file_id')
      .or(`assistant_row_id.eq.${assistant.row_id},prompt_row_id.eq.${child_prompt_row_id}`);

    // Build Confluence context from attached pages (non-uploaded ones)
    let confluenceContext = '';
    const confluenceFileAttachments: any[] = [];

    if (confluencePages && confluencePages.length > 0) {
      const textPages = confluencePages.filter(p => p.content_text && !p.openai_file_id);
      const uploadedPages = confluencePages.filter(p => p.openai_file_id);

      if (textPages.length > 0) {
        confluenceContext = textPages
          .map(p => `## ${p.page_title}\n${p.content_text}`)
          .join('\n\n---\n\n');
        confluenceContext = `[Attached Confluence Context]\n${confluenceContext}\n\n---\n\n`;
      }

      // Add uploaded Confluence files as attachments
      for (const page of uploadedPages) {
        confluenceFileAttachments.push({
          file_id: page.openai_file_id,
          tools: [{ type: 'file_search' }],
        });
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

    // Determine thread strategy - use request value or fall back to stored value
    const childThreadStrategy = requestStrategy || childPrompt.child_thread_strategy || 'isolated';
    const threadMode = childPrompt.thread_mode || 'new';
    
    console.log('Thread strategy:', childThreadStrategy, 'Thread mode:', threadMode);

    // Determine thread based on strategy
    let threadId: string;
    let threadRowId: string | null = null;

    if (childThreadStrategy === 'parent') {
      // Use parent assistant's Studio thread (where child_prompt_row_id is null)
      const { data: studioThread } = await supabase
        .from('cyg_threads')
        .select('row_id, openai_thread_id')
        .eq('assistant_row_id', assistant.row_id)
        .is('child_prompt_row_id', null)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (studioThread) {
        threadId = studioThread.openai_thread_id;
        threadRowId = studioThread.row_id;
        console.log('Using parent Studio thread:', threadId);
      } else {
        // Create new Studio thread for parent
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({}),
        });

        if (!threadResponse.ok) {
          const error = await threadResponse.json();
          return new Response(
            JSON.stringify({ error: error.error?.message || 'Failed to create thread' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const thread = await threadResponse.json();
        threadId = thread.id;

        // Save as Studio thread (no child_prompt_row_id)
        const { data: savedThread } = await supabase
          .from('cyg_threads')
          .insert({
            assistant_row_id: assistant.row_id,
            child_prompt_row_id: null,
            openai_thread_id: threadId,
            name: `Studio Thread`,
          })
          .select()
          .single();

        threadRowId = savedThread?.row_id || null;
        console.log('Created new parent Studio thread:', threadId);
      }
    } else if (threadMode === 'reuse') {
      // Isolated strategy with reuse mode - find or create child-specific thread
      const { data: existingThread } = await supabase
        .from('cyg_threads')
        .select('row_id, openai_thread_id')
        .eq('child_prompt_row_id', child_prompt_row_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingThread) {
        threadId = existingThread.openai_thread_id;
        threadRowId = existingThread.row_id;
        console.log('Reusing child thread:', threadId);
      } else {
        // Create new thread for this child
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({}),
        });

        if (!threadResponse.ok) {
          const error = await threadResponse.json();
          return new Response(
            JSON.stringify({ error: error.error?.message || 'Failed to create thread' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const thread = await threadResponse.json();
        threadId = thread.id;

        // Save thread for this child
        const { data: savedThread } = await supabase
          .from('cyg_threads')
          .insert({
            assistant_row_id: assistant.row_id,
            child_prompt_row_id,
            openai_thread_id: threadId,
            name: `Thread ${new Date().toISOString().split('T')[0]}`,
          })
          .select()
          .single();

        threadRowId = savedThread?.row_id || null;
        console.log('Created new child thread for reuse:', threadId);
      }
    } else {
      // Isolated strategy with new mode - create ephemeral thread
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({}),
      });

      if (!threadResponse.ok) {
        const error = await threadResponse.json();
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to create thread' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const thread = await threadResponse.json();
      threadId = thread.id;
      console.log('Created ephemeral thread:', threadId);
    }

    // Build file attachments from uploaded files
    const files = assistant.cyg_assistant_files || [];
    const uploadedFiles = files.filter((f: any) => f.openai_file_id && f.upload_status === 'uploaded');
    
    console.log('Assistant files:', {
      total: files.length,
      uploaded: uploadedFiles.length,
      fileDetails: files.map((f: any) => ({
        name: f.original_filename,
        status: f.upload_status,
        hasOpenAIId: !!f.openai_file_id,
      })),
    });
    
    // Only attach files to message if they're not already in the assistant's vector store
    // Files in the vector store are automatically searchable by the assistant
    const hasVectorStore = !!assistant.vector_store_id;
    const attachments = [
      // Only attach files to message if no vector store (they'll be in a temp vector store)
      ...(hasVectorStore ? [] : uploadedFiles.map((f: any) => ({
        file_id: f.openai_file_id,
        tools: [{ type: 'file_search' }],
      }))),
      ...confluenceFileAttachments,
    ];

    console.log('File handling:', {
      hasVectorStore,
      vectorStoreId: assistant.vector_store_id,
      messageAttachments: attachments.length,
      confluenceAttachments: confluenceFileAttachments.length,
    });

    // Add message to thread with file attachments
    const messageBody: any = {
      role: 'user',
      content: finalMessage,
    };
    
    if (attachments.length > 0) {
      messageBody.attachments = attachments;
    }

    const messageResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(messageBody),
      }
    );

    if (!messageResponse.ok) {
      const error = await messageResponse.json();
      return new Response(
        JSON.stringify({ error: error.error?.message || 'Failed to add message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Added message to thread');

    // Create run
    const runResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          assistant_id: assistant.openai_assistant_id,
        }),
      }
    );

    if (!runResponse.ok) {
      const error = await runResponse.json();
      return new Response(
        JSON.stringify({ error: error.error?.message || 'Failed to create run' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const run = await runResponse.json();
    console.log('Created run:', run.id);

    // Wait for run completion (now handles function calls)
    const runResult = await waitForRunCompletion(threadId, run.id, OPENAI_API_KEY, supabase);

    if (runResult.status !== 'completed') {
      return new Response(
        JSON.stringify({ error: runResult.error || 'Run did not complete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get messages (the assistant's response)
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages?limit=1&order=desc`,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      }
    );

    if (!messagesResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch response' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data[0];

    if (!assistantMessage || assistantMessage.role !== 'assistant') {
      return new Response(
        JSON.stringify({ error: 'No assistant response found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract response text
    const responseText = assistantMessage.content
      .map((c: any) => c.text?.value || '')
      .join('\n');

    // Update child prompt with response
    await supabase
      .from('cyg_prompts')
      .update({ output_response: responseText })
      .eq('row_id', child_prompt_row_id);

    // Update thread message count if applicable
    if (threadRowId) {
      await supabase
        .from('cyg_threads')
        .update({ 
          last_message_at: new Date().toISOString() 
        })
        .eq('row_id', threadRowId);
    }

    console.log('Run completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        thread_id: threadId,
        run_id: run.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Assistant run error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
