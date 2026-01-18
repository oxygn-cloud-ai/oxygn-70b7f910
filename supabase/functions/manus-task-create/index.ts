import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getManusApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES, buildErrorResponse, getHttpStatus } from "../_shared/errorCodes.ts";

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
        JSON.stringify(buildErrorResponse(ERROR_CODES.AUTH_MISSING, 'Unauthorized')),
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

    // Build request metadata early for logging
    const requestMetadata = {
      provider: 'manus',
      task_mode: task_mode || 'adaptive',
      prompt_row_id,
      system_prompt_length: system_prompt?.length || 0,
      user_message_length: user_message?.length || 0,
      user_message_preview: user_message?.substring(0, 100),
    };

    if (!prompt_row_id) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.MISSING_FIELD, 'prompt_row_id is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_message) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.MISSING_FIELD, 'user_message is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate task_mode
    const VALID_TASK_MODES = ['chat', 'adaptive', 'agent'];
    if (task_mode && !VALID_TASK_MODES.includes(task_mode)) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.INVALID_FIELD, `Invalid task_mode. Use: ${VALID_TASK_MODES.join(', ')}`)),
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
        JSON.stringify(buildErrorResponse(ERROR_CODES.AUTH_INVALID, 'Invalid token')),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Manus API key
    const manusApiKey = await getManusApiKey(authHeader);
    if (!manusApiKey) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.MANUS_NOT_CONFIGURED, 'Manus API key not configured. Add it in Settings > Integrations.')),
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
        JSON.stringify(buildErrorResponse(ERROR_CODES.DB_INSERT_FAILED, 'Failed to create task record')),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manus-task-create] Created pending task:', tempTaskId);

    // Call Manus API to create task with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let manusResponse: Response;
    try {
      manusResponse = await fetch('https://api.manus.ai/v1/tasks', {
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
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      
      // Clean up pending record
      await supabase
        .from('q_manus_tasks')
        .delete()
        .eq('task_id', tempTaskId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify(buildErrorResponse(ERROR_CODES.MANUS_TIMEOUT, 'Manus API request timed out after 30 seconds')),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!manusResponse.ok) {
      const errorText = await manusResponse.text();
      console.error('[manus-task-create] Manus API error:', errorText);
      
      // Clean up pending record
      await supabase
        .from('q_manus_tasks')
        .delete()
        .eq('task_id', tempTaskId);
      
      // Determine error code based on status
      const errorCode = manusResponse.status === 401 ? ERROR_CODES.MANUS_INVALID_KEY : ERROR_CODES.MANUS_API_ERROR;
      
      return new Response(
        JSON.stringify(buildErrorResponse(errorCode, `Manus API error: ${errorText}`)),
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
          warning: 'Task created but tracking record may be incomplete',
          request_metadata: requestMetadata,
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
        request_metadata: requestMetadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[manus-task-create] Error:', error);
    return new Response(
      JSON.stringify(buildErrorResponse(ERROR_CODES.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error')),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
