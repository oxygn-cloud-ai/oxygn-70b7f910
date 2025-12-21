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

// Handle Confluence tool calls - only for attached pages
async function handleConfluenceTool(
  toolName: string,
  args: any,
  attachedPages: Array<{ page_id: string; page_title: string; content_text: string | null; page_url: string | null }>
): Promise<string> {
  try {
    if (toolName === 'confluence_list_attached') {
      if (!attachedPages || attachedPages.length === 0) {
        return JSON.stringify({ 
          message: 'No Confluence pages are attached to this conversation. Ask the user to attach pages via the Conversation tab.',
          pages: []
        });
      }

      const pages = attachedPages.map(p => ({
        id: p.page_id,
        title: p.page_title,
        url: p.page_url,
      }));

      return JSON.stringify({ 
        message: `${pages.length} Confluence page(s) attached to this conversation.`,
        pages 
      });
    }

    if (toolName === 'confluence_read_attached') {
      const { page_id } = args;
      
      const page = attachedPages.find(p => p.page_id === page_id);
      
      if (!page) {
        const availableIds = attachedPages.map(p => p.page_id).join(', ');
        return JSON.stringify({ 
          error: `Page ${page_id} is not attached to this conversation. Available page IDs: ${availableIds || 'none'}`,
        });
      }

      return JSON.stringify({
        id: page.page_id,
        title: page.page_title,
        content: page.content_text || '(No content available - page may need to be synced)',
        url: page.page_url,
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (error) {
    console.error('Confluence tool error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: `Confluence request failed: ${message}` });
  }
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

    // Fetch attached Confluence pages for tool access
    const { data: confluencePages } = await supabase
      .from(TABLES.CONFLUENCE_PAGES)
      .select('page_id, page_title, content_text, page_url')
      .eq('assistant_row_id', assistant_row_id);
    
    const attachedPages = (confluencePages || []).map((p: any) => ({
      page_id: p.page_id,
      page_title: p.page_title,
      content_text: p.content_text,
      page_url: p.page_url,
    }));

    // Find or create OpenAI conversation via thread
    let conversationId: string;
    let threadRowId: string | null = null;

    // Look for existing Studio thread
    const { data: existingThread } = await supabase
      .from(TABLES.THREADS)
      .select('row_id, openai_conversation_id')
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
        .select('row_id, openai_conversation_id')
        .eq('row_id', thread_row_id)
        .single();

      if (specifiedThread) {
        if (specifiedThread.openai_conversation_id && !specifiedThread.openai_conversation_id.startsWith('pending_')) {
          conversationId = specifiedThread.openai_conversation_id;
        } else {
          // Create new conversation for pending thread
          conversationId = await createOpenAIConversation(openAIApiKey, { assistant_row_id });
          await supabase
            .from(TABLES.THREADS)
            .update({ openai_conversation_id: conversationId })
            .eq('row_id', thread_row_id);
        }
        threadRowId = specifiedThread.row_id;
      } else {
        // Specified thread not found, create new
        conversationId = await createOpenAIConversation(openAIApiKey, { assistant_row_id });
      }
    } else if (existingThread) {
      if (existingThread.openai_conversation_id && !existingThread.openai_conversation_id.startsWith('pending_')) {
        conversationId = existingThread.openai_conversation_id;
      } else {
        // Create new conversation for pending thread
        conversationId = await createOpenAIConversation(openAIApiKey, { assistant_row_id });
        await supabase
          .from(TABLES.THREADS)
          .update({ openai_conversation_id: conversationId })
          .eq('row_id', existingThread.row_id);
      }
      threadRowId = existingThread.row_id;
    } else {
      // No existing thread, create new conversation and thread
      conversationId = await createOpenAIConversation(openAIApiKey, { assistant_row_id });
    }

    console.log('Using conversation:', conversationId);

    const modelId = assistantData.model_override || 'gpt-4o';

    // Build tools array with attached page IDs
    const attachedConfluencePageIds = attachedPages.map(p => p.page_id);
    const tools = getAllTools({
      codeInterpreterEnabled: assistantData.code_interpreter_enabled || false,
      fileSearchEnabled: assistantData.file_search_enabled || false,
      confluenceEnabled: assistantData.confluence_enabled || false,
      vectorStoreIds: assistantData.vector_store_id ? [assistantData.vector_store_id] : undefined,
      attachedConfluencePageIds,
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
      conversation: conversationId,
      store: true,
    };

    // Add model parameters
    const temperature = assistantData.temperature_override ? parseFloat(assistantData.temperature_override) : undefined;
    if (temperature !== undefined && !isNaN(temperature)) requestBody.temperature = temperature;

    console.log('Calling Responses API for Studio chat:', { model: modelId, toolCount: tools.length, conversationId });

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
            output = await handleConfluenceTool(functionName, args, attachedPages);
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

      // Continue with function outputs using conversation
      const continueBody: any = {
        model: modelId,
        conversation: conversationId,
        input: functionCallOutputs,
        tools: tools.length > 0 ? tools : undefined,
        store: true,
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
        .update({ last_message_at: new Date().toISOString() })
        .eq('row_id', threadRowId);
    } else {
      const { data: newThread } = await supabase
        .from(TABLES.THREADS)
        .insert({
          assistant_row_id: assistant_row_id,
          child_prompt_row_id: null,
          openai_conversation_id: conversationId,
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
        })
        .select()
        .single();

      threadRowId = newThread?.row_id || null;
    }

    console.log('Studio chat completed');

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        response_id: responseData.id,
        thread_row_id: threadRowId,
        conversation_id: conversationId,
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