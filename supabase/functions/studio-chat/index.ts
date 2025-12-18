import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Helper function to wait for run completion
async function waitForRunCompletion(
  threadId: string,
  runId: string,
  apiKey: string,
  maxAttempts = 60,
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

    if (['completed', 'failed', 'cancelled', 'expired'].includes(run.status)) {
      return {
        status: run.status,
        error: run.last_error?.message,
      };
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

    // Fetch assistant details with files
    const { data: assistant, error: assistantError } = await supabase
      .from('cyg_assistants')
      .select('*, cyg_prompts!cyg_assistants_prompt_row_id_fkey(*), cyg_assistant_files(*)')
      .eq('row_id', assistant_row_id)
      .single();

    if (assistantError || !assistant) {
      console.error('Error fetching assistant:', assistantError);
      return new Response(
        JSON.stringify({ error: 'Assistant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!assistant.openai_assistant_id || assistant.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Assistant is not instantiated. Please instantiate it first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build child prompt context if enabled
    let additionalInstructions = '';
    const contextIncluded: string[] = [];

    if (include_child_context && assistant.prompt_row_id) {
      const { data: childPrompts, error: childError } = await supabase
        .from('cyg_prompts')
        .select('prompt_name, input_admin_prompt, input_user_prompt, note')
        .eq('parent_row_id', assistant.prompt_row_id)
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
        .from('cyg_threads')
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
        .from('cyg_threads')
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
      assistant_id: assistant.openai_assistant_id,
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

    // Wait for completion
    const completion = await waitForRunCompletion(openaiThreadId, run.id, openAIApiKey);

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
      .from('cyg_threads')
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
