import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getManusApiKey } from "../_shared/credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { 
      prompt_row_id, 
      user_message, 
      system_prompt,
      task_mode = 'adaptive',
      trace_id
    } = await req.json();

    if (!prompt_row_id || !user_message) {
      return new Response(
        JSON.stringify({ error: 'prompt_row_id and user_message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Manus API key
    const manusApiKey = await getManusApiKey(authHeader);
    if (!manusApiKey) {
      return new Response(
        JSON.stringify({ error: 'Manus API key not configured. Add it in Settings > Integrations.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Build the combined prompt for Manus
    let combinedPrompt = '';
    if (system_prompt) {
      combinedPrompt += `System Instructions:\n${system_prompt}\n\n`;
    }
    combinedPrompt += user_message;

    // Create pending task record first (for Realtime subscription)
    const tempTaskId = `pending-${crypto.randomUUID()}`;
    const { error: insertError } = await supabase
      .from('q_manus_tasks')
      .insert({
        task_id: tempTaskId,
        prompt_row_id,
        owner_id: user.id,
        trace_id: trace_id || null,
        status: 'pending',
      });

    if (insertError) {
      console.error('[manus-task-create] Failed to create task record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create task record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manus-task-create] Created pending task:', tempTaskId);

    // Call Manus API to create task
    const manusResponse = await fetch('https://api.manus.ai/v1/tasks', {
      method: 'POST',
      headers: {
        'API_KEY': manusApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: combinedPrompt,
        taskMode: task_mode,
        agentProfile: task_mode === 'agent' ? 'quality' : 'speed',
      }),
    });

    if (!manusResponse.ok) {
      const error = await manusResponse.text();
      console.error('[manus-task-create] Manus API error:', error);
      
      // Clean up pending record
      await supabase
        .from('q_manus_tasks')
        .delete()
        .eq('task_id', tempTaskId);
      
      return new Response(
        JSON.stringify({ error: `Manus API error: ${error}` }),
        { status: manusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manusData = await manusResponse.json();
    const actualTaskId = manusData.task_id;

    console.log('[manus-task-create] Manus task created:', actualTaskId);

    // Update record with actual task_id
    // Since task_id is PRIMARY KEY, we need to delete old and insert new
    await supabase
      .from('q_manus_tasks')
      .delete()
      .eq('task_id', tempTaskId);
    
    const { error: finalInsertError } = await supabase
      .from('q_manus_tasks')
      .insert({
        task_id: actualTaskId,
        prompt_row_id,
        owner_id: user.id,
        trace_id: trace_id || null,
        status: 'created',
        task_url: manusData.task_url,
      });

    if (finalInsertError) {
      console.error('[manus-task-create] Failed to insert final task:', finalInsertError);
      // Task was created on Manus side but we failed to track it
      return new Response(
        JSON.stringify({ 
          success: true, 
          task_id: actualTaskId,
          task_url: manusData.task_url,
          warning: 'Task created but tracking record may be incomplete'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        task_id: actualTaskId,
        task_url: manusData.task_url,
        prompt_row_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[manus-task-create] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
