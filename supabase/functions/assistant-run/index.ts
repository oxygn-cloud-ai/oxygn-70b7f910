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

// Poll for run completion
async function waitForRunCompletion(
  threadId: string, 
  runId: string, 
  apiKey: string,
  maxAttempts = 60,
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
    const { child_prompt_row_id, user_message, template_variables } = await req.json();

    console.log('Assistant run request:', { child_prompt_row_id, user: validation.user?.email });

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
    const finalMessage = user_message 
      ? applyTemplate(user_message, variables)
      : childPrompt.input_user_prompt || '';

    if (!finalMessage.trim()) {
      return new Response(
        JSON.stringify({ error: 'No message to send' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine thread based on thread_mode
    let threadId: string;
    let threadRowId: string | null = null;
    const threadMode = childPrompt.thread_mode || 'new';

    if (threadMode === 'reuse') {
      // Try to find existing active thread for this child prompt
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
        console.log('Reusing thread:', threadId);
      } else {
        // Create new thread if none exists
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

        // Save thread
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
        console.log('Created new thread for reuse:', threadId);
      }
    } else {
      // Create new thread for this run
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
    
    const attachments = uploadedFiles.map((f: any) => ({
      file_id: f.openai_file_id,
      tools: [{ type: 'file_search' }],
    }));

    console.log('Attaching files to message:', attachments.length);

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

    // Wait for run completion
    const runResult = await waitForRunCompletion(threadId, run.id, OPENAI_API_KEY);

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
