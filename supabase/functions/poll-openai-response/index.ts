import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getOpenAIApiKey } from "../_shared/credentials.ts";
import { buildErrorResponse, getHttpStatus, ERROR_CODES } from "../_shared/errorCodes.ts";

const ALLOWED_DOMAINS = ['chocfin.com', 'oxygn.cloud'];

function isAllowedDomain(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

interface OpenAIResponseOutput {
  type: string;
  content?: Array<{ type: string; text?: string }>;
}

interface OpenAIResponse {
  id: string;
  status: string;
  output?: OpenAIResponseOutput[];
  error?: { message?: string; code?: string };
}

interface PollResult {
  status: string;
  reasoning_text: string | null;
  output_text: string | null;
}

/**
 * Extract reasoning and output text from OpenAI Responses API output array.
 */
function extractContent(output: OpenAIResponseOutput[] | undefined): { reasoning: string | null; outputText: string | null } {
  if (!output || !Array.isArray(output)) return { reasoning: null, outputText: null };

  let reasoning = '';
  let outputText = '';

  for (const item of output) {
    if (item.type === 'reasoning' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          reasoning += block.text;
        }
      }
    }
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if ((block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string') {
          outputText += block.text;
        }
      }
    }
  }

  return {
    reasoning: reasoning || null,
    outputText: outputText || null,
  };
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.AUTH_MISSING)),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.AUTH_INVALID)),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAllowedDomain(user.email)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Parse body ---
    const body = await req.json();
    const responseId: unknown = body?.response_id;

    if (typeof responseId !== 'string' || !responseId) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.MISSING_FIELD, 'response_id is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Ownership check: verify this pending response belongs to the caller ---
    const { data: pendingRow, error: pendingError } = await supabase
      .from('q_pending_responses')
      .select('row_id, status, owner_id, prompt_row_id, output_text')
      .eq('response_id', responseId)
      .maybeSingle();

    if (pendingError) {
      console.error('[poll-openai-response] DB lookup error:', pendingError);
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.INTERNAL_ERROR)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingRow) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.PROMPT_NOT_FOUND, 'Pending response not found')),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (pendingRow.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to poll this response' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If the row is already terminal, return its status without calling OpenAI
    if (['completed', 'failed', 'cancelled', 'incomplete'].includes(pendingRow.status)) {
      console.log('[poll-openai-response] Already terminal:', pendingRow.status);
      return new Response(
        JSON.stringify({ status: pendingRow.status, reasoning_text: null, output_text: pendingRow.output_text || null } satisfies PollResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Get OpenAI key ---
    const openaiKey = await getOpenAIApiKey(authHeader);
    if (!openaiKey) {
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.OPENAI_NOT_CONFIGURED)),
        { status: getHttpStatus(ERROR_CODES.OPENAI_NOT_CONFIGURED), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Poll OpenAI ---
    const openaiResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error('[poll-openai-response] OpenAI GET error:', openaiResponse.status, errBody);
      return new Response(
        JSON.stringify(buildErrorResponse(ERROR_CODES.OPENAI_API_ERROR, `OpenAI returned ${openaiResponse.status}`)),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData: OpenAIResponse = await openaiResponse.json();
    const { reasoning, outputText } = extractContent(openaiData.output);

    if (!outputText && openaiData.status === 'completed') {
      console.warn('[poll-openai-response] [DIAG] Empty output extraction for completed response:', {
        responseId,
        outputItemCount: openaiData.output?.length ?? 0,
        outputTypes: openaiData.output?.map((item: OpenAIResponseOutput) => item.type) ?? [],
        rawOutputPreview: JSON.stringify(openaiData.output)?.substring(0, 500),
      });
    }

    console.log('[poll-openai-response] Status:', openaiData.status, '| reasoning:', !!reasoning, '| output:', !!outputText);

    // --- If terminal, update DB as webhook fallback ---
    const terminalStatuses = ['completed', 'failed', 'cancelled', 'incomplete'];
    if (terminalStatuses.includes(openaiData.status) && pendingRow.status === 'pending') {
      console.log('[poll-openai-response] Detected terminal status via polling, updating DB...');

      const syntheticWebhookId = `poll_fallback_${responseId}`;

      // Update q_pending_responses
      const { error: updateError } = await supabase
        .from('q_pending_responses')
        .update({
          status: openaiData.status === 'completed' ? 'completed' : 'failed',
          output_text: outputText,
          error: openaiData.error?.message || null,
          error_code: openaiData.error?.code || null,
          completed_at: new Date().toISOString(),
          webhook_event_id: syntheticWebhookId,
        })
        .eq('response_id', responseId)
        .eq('status', 'pending'); // Only update if still pending (idempotent)

      if (updateError) {
        console.error('[poll-openai-response] Failed to update pending response:', updateError);
      }

      // If completed and we have output, also update the prompt
      if (openaiData.status === 'completed' && outputText && pendingRow.prompt_row_id) {
        const { error: promptUpdateError } = await supabase
          .from('q_prompts')
          .update({
            output_response: outputText,
            user_prompt_result: outputText,
            updated_at: new Date().toISOString(),
          })
          .eq('row_id', pendingRow.prompt_row_id);

        if (promptUpdateError) {
          console.error('[poll-openai-response] Failed to update prompt:', promptUpdateError);
        }
      }
    }

    const result: PollResult = {
      status: openaiData.status,
      reasoning_text: reasoning,
      output_text: outputText,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[poll-openai-response] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
