import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { resolveRootPromptId, clearFamilyThread } from "../_shared/familyThreads.ts";

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
  // Try SUPABASE_ANON_KEY first, fallback to SUPABASE_PUBLISHABLE_KEY
  const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars:', { 
      hasUrl: !!SUPABASE_URL, 
      hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      hasPublishableKey: !!Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    });
    return { valid: false, error: 'Server configuration error' };
  }

  // Extract the token from the header
  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.error('Auth error:', error?.message || 'No user returned');
    return { valid: false, error: 'Invalid or expired token' };
  }

  if (!isAllowedDomain(user.email)) {
    return { valid: false, error: 'Access denied. Only chocfin.com and oxygn.cloud accounts are allowed.' };
  }

  return { valid: true, user };
}

// Create OpenAI conversation
async function createOpenAIConversation(apiKey: string, metadata?: Record<string, string>): Promise<string> {
  console.log('Creating new OpenAI conversation...');
  
  const response = await fetch('https://api.openai.com/v1/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metadata: metadata || {},
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create OpenAI conversation:', error);
    throw new Error(error.error?.message || 'Failed to create conversation');
  }

  const data = await response.json();
  console.log('Created OpenAI conversation:', data.id);
  return data.id;
}

// Delete OpenAI conversation
async function deleteOpenAIConversation(apiKey: string, conversationId: string): Promise<void> {
  if (!conversationId || conversationId.startsWith('pending_')) {
    console.log('Skipping deletion of pending/invalid conversation:', conversationId);
    return;
  }

  console.log('Deleting OpenAI conversation:', conversationId);
  
  const response = await fetch(`https://api.openai.com/v1/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to delete OpenAI conversation:', error);
    // Don't throw - we still want to delete the local record
  } else {
    console.log('Deleted OpenAI conversation:', conversationId);
  }
}

// Fetch messages from OpenAI Conversations API
async function fetchMessagesFromOpenAI(apiKey: string, conversationId: string, limit: number = 50): Promise<any[]> {
  if (!conversationId || conversationId.startsWith('pending_')) {
    console.log('No valid conversation ID, returning empty messages');
    return [];
  }

  console.log('Fetching messages from OpenAI conversation:', conversationId);
  
  const response = await fetch(`https://api.openai.com/v1/conversations/${conversationId}/items?limit=${limit}&order=asc`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to fetch messages from OpenAI:', error);
    return [];
  }

  const data = await response.json();
  const items = data.data || [];
  
  // Transform OpenAI items to our message format
  const messages: any[] = [];
  
  for (const item of items) {
    if (item.type === 'message') {
      // Never show system/developer prompts in the UI message stream
      if (item.role === 'system' || item.role === 'developer') continue;

      // Extract text content from message
      let content = '';
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === 'output_text' || part.type === 'input_text') {
            content += part.text || '';
          } else if (part.type === 'text') {
            content += part.text || '';
          }
        }
      } else if (typeof item.content === 'string') {
        content = item.content;
      }

      if (content.trim()) {
        // Safely parse created_at - it might be missing or invalid
        let createdAt: string;
        try {
          createdAt = item.created_at 
            ? new Date(item.created_at * 1000).toISOString() 
            : new Date().toISOString();
        } catch {
          createdAt = new Date().toISOString();
        }
        
        messages.push({
          id: item.id,
          role: item.role,
          content: content.trim(),
          created_at: createdAt,
        });
      }
    }
  }

  console.log('Fetched messages from OpenAI:', messages.length);
  return messages;
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { action, ...body } = await req.json();

    console.log('Thread manager request:', { action, user: validation.user?.email });

    // CREATE - Create a new thread with OpenAI conversation
    if (action === 'create') {
      const { assistant_row_id, child_prompt_row_id, name, root_prompt_row_id } = body;

      // Generate a name if not provided
      const threadName = name || `Thread ${new Date().toISOString().split('T')[0]}`;

      // Use a pending placeholder - will be updated with real response_id after first API call
      const tempConversationId = `pending-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      // Save to database - include root_prompt_row_id for unified family threads
      const { data: savedThread, error: saveError } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id,
          child_prompt_row_id,
          root_prompt_row_id, // New: for unified family thread lookup
          openai_conversation_id: tempConversationId,
          name: threadName,
          is_active: true,
          owner_id: validation.user?.id, // Always set owner
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

      console.log('Created thread:', savedThread.row_id, 'root:', root_prompt_row_id);

      return new Response(
        JSON.stringify({ success: true, thread: savedThread }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST - List threads for an assistant, child prompt, or root prompt family
    if (action === 'list') {
      const { assistant_row_id, child_prompt_row_id, root_prompt_row_id } = body;

      console.log('Listing threads:', { assistant_row_id, child_prompt_row_id, root_prompt_row_id });

      let query = supabase
        .from(TABLES.THREADS)
        .select('*')
        .eq('owner_id', validation.user?.id) // Always filter by owner
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Unified family thread lookup by root_prompt_row_id
      if (root_prompt_row_id) {
        query = query.eq('root_prompt_row_id', root_prompt_row_id);
      } else if (assistant_row_id) {
        query = query.eq('assistant_row_id', assistant_row_id);
      } else if (child_prompt_row_id) {
        query = query.eq('child_prompt_row_id', child_prompt_row_id);
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

    // DELETE - Delete a thread and its OpenAI conversation
    if (action === 'delete') {
      const { thread_row_id } = body;

      // First, get the thread to get the conversation ID
      const { data: thread } = await supabase
        .from(TABLES.THREADS)
        .select('openai_conversation_id')
        .eq('row_id', thread_row_id)
        .single();

      // Delete from OpenAI
      if (thread?.openai_conversation_id) {
        await deleteOpenAIConversation(OPENAI_API_KEY, thread.openai_conversation_id);
      }

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

    // GET_MESSAGES - Get messages from OpenAI Conversations API
    if (action === 'get_messages') {
      const { thread_row_id, limit = 50 } = body;

      // Get the thread to get the conversation ID
      const { data: thread, error: threadError } = await supabase
        .from(TABLES.THREADS)
        .select('openai_conversation_id')
        .eq('row_id', thread_row_id)
        .single();

      if (threadError || !thread) {
        console.error('Thread not found:', threadError);
        return new Response(
          JSON.stringify({ error: 'Thread not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch messages from OpenAI
      const messages = await fetchMessagesFromOpenAI(OPENAI_API_KEY, thread.openai_conversation_id, limit);

      console.log('Returning messages:', messages.length);

      return new Response(
        JSON.stringify({ messages, source: 'openai' }),
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