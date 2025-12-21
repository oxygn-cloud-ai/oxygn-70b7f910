import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { action, ...body } = await req.json();

    console.log('Thread manager request:', { action, user: validation.user?.email });

    // CREATE - Create a new thread (local only, no OpenAI thread needed for Responses API)
    if (action === 'create') {
      const { assistant_row_id, child_prompt_row_id, name } = body;

      // Generate a name if not provided
      const threadName = name || `Thread ${new Date().toISOString().split('T')[0]}`;

      // Save to database (no OpenAI thread for Responses API)
      const { data: savedThread, error: saveError } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id,
          child_prompt_row_id,
          openai_thread_id: `local_${Date.now()}`, // Local placeholder for Responses API
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

      console.log('Created local thread:', savedThread.row_id);

      return new Response(
        JSON.stringify({ success: true, thread: savedThread }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST - List threads for an assistant or child prompt
    if (action === 'list') {
      const { assistant_row_id, child_prompt_row_id, include_parent_threads } = body;

      console.log('Listing threads:', { assistant_row_id, child_prompt_row_id, include_parent_threads });

      let query = supabase
        .from(TABLES.THREADS)
        .select('*')
        .order('created_at', { ascending: false });

      if (assistant_row_id) {
        query = query.eq('assistant_row_id', assistant_row_id);
      }
      
      // Handle child_prompt_row_id filtering properly
      if (child_prompt_row_id) {
        // If include_parent_threads is true, get both child-specific AND parent (null) threads
        if (include_parent_threads) {
          query = query.or(`child_prompt_row_id.eq.${child_prompt_row_id},child_prompt_row_id.is.null`);
        } else {
          query = query.eq('child_prompt_row_id', child_prompt_row_id);
        }
      } else if (child_prompt_row_id === null) {
        // Explicitly looking for parent threads only
        query = query.is('child_prompt_row_id', null);
      }

      const { data: threads, error } = await query;

      if (error) {
        console.error('Failed to fetch threads:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch threads' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found threads:', threads?.length || 0);

      return new Response(
        JSON.stringify({ threads }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete a thread
    if (action === 'delete') {
      const { thread_row_id } = body;

      // Delete messages first
      await supabase
        .from('q_thread_messages')
        .delete()
        .eq('thread_row_id', thread_row_id);

      // Delete from database
      await supabase
        .from(TABLES.THREADS)
        .delete()
        .eq('row_id', thread_row_id);

      console.log('Deleted thread:', thread_row_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET_MESSAGES - Get messages from a thread
    if (action === 'get_messages') {
      const { thread_row_id, limit = 50 } = body;

      // Fetch from q_thread_messages
      const { data: dbMessages, error: dbError } = await supabase
        .from('q_thread_messages')
        .select('row_id, role, content, response_id, created_at')
        .eq('thread_row_id', thread_row_id)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (dbError) {
        console.error('Failed to fetch messages:', dbError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const messages = (dbMessages || []).map((msg: any) => ({
        id: msg.row_id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        response_id: msg.response_id,
      }));

      console.log('Returning messages:', messages.length);

      return new Response(
        JSON.stringify({ messages, source: 'database' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RENAME - Rename a thread
    if (action === 'rename') {
      const { thread_row_id, name } = body;

      await supabase
        .from(TABLES.THREADS)
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
