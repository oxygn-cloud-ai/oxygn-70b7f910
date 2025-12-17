import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { action, ...body } = await req.json();

    console.log('Thread manager request:', { action });

    // CREATE - Create a new thread
    if (action === 'create') {
      const { assistant_row_id, child_prompt_row_id, name } = body;

      // Create thread in OpenAI
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
        console.error('Failed to create thread:', error);
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to create thread' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const thread = await threadResponse.json();
      console.log('Created OpenAI thread:', thread.id);

      // Generate a name if not provided
      const threadName = name || `Thread ${new Date().toISOString().split('T')[0]}`;

      // Save to database
      const { data: savedThread, error: saveError } = await supabase
        .from('cyg_threads')
        .insert({
          assistant_row_id,
          child_prompt_row_id,
          openai_thread_id: thread.id,
          name: threadName,
          is_active: true,
        })
        .select()
        .single();

      if (saveError) {
        console.error('Failed to save thread:', saveError);
        return new Response(
          JSON.stringify({ error: 'Failed to save thread' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, thread: savedThread }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST - List threads for an assistant or child prompt
    if (action === 'list') {
      const { assistant_row_id, child_prompt_row_id } = body;

      let query = supabase
        .from('cyg_threads')
        .select('*')
        .order('created_at', { ascending: false });

      if (assistant_row_id) {
        query = query.eq('assistant_row_id', assistant_row_id);
      }
      if (child_prompt_row_id) {
        query = query.eq('child_prompt_row_id', child_prompt_row_id);
      }

      const { data: threads, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch threads' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ threads }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete a thread
    if (action === 'delete') {
      const { thread_row_id } = body;

      // Get thread info
      const { data: thread } = await supabase
        .from('cyg_threads')
        .select('openai_thread_id')
        .eq('row_id', thread_row_id)
        .single();

      if (thread?.openai_thread_id) {
        // Delete from OpenAI
        await fetch(`https://api.openai.com/v1/threads/${thread.openai_thread_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2',
          },
        });
        console.log('Deleted OpenAI thread:', thread.openai_thread_id);
      }

      // Delete from database
      await supabase
        .from('cyg_threads')
        .delete()
        .eq('row_id', thread_row_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET_MESSAGES - Get messages from a thread
    if (action === 'get_messages') {
      const { thread_row_id, limit = 20 } = body;

      // Get thread info
      const { data: thread } = await supabase
        .from('cyg_threads')
        .select('openai_thread_id')
        .eq('row_id', thread_row_id)
        .single();

      if (!thread?.openai_thread_id) {
        return new Response(
          JSON.stringify({ error: 'Thread not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch messages from OpenAI
      const messagesResponse = await fetch(
        `https://api.openai.com/v1/threads/${thread.openai_thread_id}/messages?limit=${limit}&order=desc`,
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2',
          },
        }
      );

      if (!messagesResponse.ok) {
        const error = await messagesResponse.json();
        return new Response(
          JSON.stringify({ error: error.error?.message || 'Failed to fetch messages' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const messagesData = await messagesResponse.json();

      // Format messages for easier consumption
      const messages = messagesData.data.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.map((c: any) => c.text?.value || '').join('\n'),
        created_at: new Date(msg.created_at * 1000).toISOString(),
      })).reverse(); // Reverse to get chronological order

      return new Response(
        JSON.stringify({ messages }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RENAME - Rename a thread
    if (action === 'rename') {
      const { thread_row_id, name } = body;

      await supabase
        .from('cyg_threads')
        .update({ name })
        .eq('row_id', thread_row_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: create, list, delete, get_messages, or rename' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Thread manager error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
