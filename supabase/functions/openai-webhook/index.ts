import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// TypeScript interfaces for type safety
interface WebhookPayload {
  type: string;
  id: string;
  created_at: number;
  data: {
    id: string;
    status?: string;
    error?: {
      code?: string;
      message?: string;
    };
    output?: Array<{
      type: string;
      content?: Array<{
        type: string;
        text?: string;
      }>;
    }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

interface PendingResponse {
  row_id: string;
  response_id: string;
  owner_id: string;
  prompt_row_id: string | null;
  thread_row_id: string | null;
  trace_id: string | null;
  source_function: string;
  status: string;
  webhook_event_id: string | null;
  request_metadata: Record<string, unknown>;
}

// Standard Webhooks signature verification
async function verifyWebhookSignature(
  req: Request,
  body: string,
  secret: string
): Promise<boolean> {
  const webhookId = req.headers.get('webhook-id');
  const webhookTimestamp = req.headers.get('webhook-timestamp');
  const webhookSignature = req.headers.get('webhook-signature');
  
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.error('[openai-webhook] [DIAG] Missing signature headers:', {
      hasWebhookId: !!webhookId,
      hasWebhookTimestamp: !!webhookTimestamp,
      hasWebhookSignature: !!webhookSignature,
    });
    return false;
  }
  
  // Check timestamp is within 5 minutes (300 seconds)
  const timestamp = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  const deltaSeconds = Math.abs(now - timestamp);
  if (deltaSeconds > 300) {
    console.error('[openai-webhook] [DIAG] Timestamp outside acceptable range:', {
      timestamp,
      now,
      deltaSeconds,
    });
    return false;
  }
  
  try {
    // Construct signature payload per Standard Webhooks spec
    const signaturePayload = `${webhookId}.${webhookTimestamp}.${body}`;
    
    // Decode base64 secret (remove whsec_ prefix if present)
    const secretBase64 = secret.replace('whsec_', '');
    const secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));
    
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signaturePayload)
    );
    
    const computedSignature = 'v1,' + btoa(
      String.fromCharCode(...new Uint8Array(signatureBytes))
    );
    
    // Check if computed signature matches any provided signature
    const receivedSignatures = webhookSignature.split(' ');
    let matched = receivedSignatures.some(sig => sig === computedSignature);
    
    // Fallback: try raw secret bytes (not base64-decoded) in case format differs
    if (!matched) {
      try {
        const rawSecretStr = secret.replace('whsec_', '');
        const rawKey = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(rawSecretStr),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const rawSigBytes = await crypto.subtle.sign(
          'HMAC',
          rawKey,
          new TextEncoder().encode(signaturePayload)
        );
        const rawComputedSig = 'v1,' + btoa(
          String.fromCharCode(...new Uint8Array(rawSigBytes))
        );
        matched = receivedSignatures.some(sig => sig === rawComputedSig);
        if (matched) {
          console.log('[openai-webhook] [DIAG] Matched using raw secret fallback');
        }
      } catch (fallbackErr: unknown) {
        console.warn('[openai-webhook] [DIAG] Raw fallback failed:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
      }
    }
    
    if (!matched) {
      console.error('[openai-webhook] [DIAG] Signature mismatch:', {
        computedPrefix: computedSignature.slice(0, 20) + '...',
        receivedPrefixes: receivedSignatures.map(s => s.slice(0, 20) + '...'),
        secretLength: secret.length,
        hasWhsecPrefix: secret.startsWith('whsec_'),
        bodyLength: body.length,
      });
    }
    
    return matched;
  } catch (error: unknown) {
    console.error('[openai-webhook] [DIAG] Signature verification error:', {
      error: error instanceof Error ? error.message : String(error),
      secretLength: secret.length,
      hasWhsecPrefix: secret.startsWith('whsec_'),
    });
    return false;
  }
}

// Extract output text from OpenAI response output array
function extractOutputText(output: WebhookPayload['data']['output']): string {
  let text = '';
  for (const item of output || []) {
    if (item.type === 'message' && item.content) {
      for (const c of item.content) {
        if (c.type === 'output_text' && c.text) {
          text += c.text;
        }
      }
    }
  }
  return text;
}

serve(async (req) => {
  const body = await req.text();
  
  // Verify signature if secret is configured
  const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');
  if (webhookSecret) {
    console.log('[openai-webhook] [DIAG] Verifying signature:', {
      secretLength: webhookSecret.length,
      hasWhsecPrefix: webhookSecret.startsWith('whsec_'),
    });
    const isValid = await verifyWebhookSignature(req, body, webhookSecret);
    if (!isValid) {
      console.error('[openai-webhook] Invalid webhook signature - see [DIAG] logs above');
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('[openai-webhook] No webhook secret configured, skipping verification');
  }
  
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error('[openai-webhook] Invalid JSON payload');
    return new Response('Bad Request', { status: 400 });
  }
  
  const { type, id: eventId, data } = payload;
  const responseId = data?.id;
  
  // PHASE 1 FIX: Validate responseId before processing
  if (!responseId) {
    console.warn('[openai-webhook] No response_id in payload:', { type, eventId });
    return new Response('OK', { status: 200 });
  }
  
  console.log('[openai-webhook] Event received:', { type, responseId, eventId });
  
  // Use service role for database operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Run cleanup on each webhook invocation (no pg_cron dependency)
  try {
    await supabase.rpc('cleanup_orphaned_pending_responses');
  } catch (cleanupError) {
    console.warn('[openai-webhook] Cleanup failed:', cleanupError);
  }
  
  // Find pending response
  const { data: pendingResponse } = await supabase
    .from('q_pending_responses')
    .select('*')
    .eq('response_id', responseId)
    .maybeSingle() as { data: PendingResponse | null };
  
  if (!pendingResponse) {
    console.log('[openai-webhook] No pending response for:', responseId);
    return new Response('OK', { status: 200 });
  }
  
  // Idempotency check
  if (pendingResponse.webhook_event_id === eventId) {
    console.log('[openai-webhook] Event already processed:', eventId);
    return new Response('OK', { status: 200 });
  }
  
  const now = new Date().toISOString();
  
  switch (type) {
    case 'response.completed': {
      // Extract output directly from webhook payload (no API call needed)
      const outputText = extractOutputText(data.output);
      
      // PHASE 1 FIX: Update pending response with error handling
      const { error: pendingUpdateError } = await supabase.from('q_pending_responses')
        .update({
          status: 'completed',
          output_text: outputText,
          completed_at: now,
          webhook_event_id: eventId,
        })
        .eq('row_id', pendingResponse.row_id);
      
      if (pendingUpdateError) {
        console.error('[openai-webhook] Failed to update pending response:', pendingUpdateError);
        return new Response('Internal Server Error', { status: 500 });
      }
      
      // Update thread last_response_id if available
      if (pendingResponse.thread_row_id) {
        const { error: threadError } = await supabase.from('q_threads')
          .update({ last_response_id: responseId })
          .eq('row_id', pendingResponse.thread_row_id);
        
        if (threadError) {
          console.warn('[openai-webhook] Failed to update thread:', threadError);
          // Non-critical: continue processing
        }
      }
      
      // Update prompt output_response if available
      if (pendingResponse.prompt_row_id) {
        const { error: promptError } = await supabase.from('q_prompts')
          .update({
            output_response: outputText,
            user_prompt_result: outputText,
            updated_at: now,
          })
          .eq('row_id', pendingResponse.prompt_row_id);
        
        if (promptError) {
          console.warn('[openai-webhook] Failed to update prompt:', promptError);
          // Non-critical: continue processing
        }
      }
      
      // Complete execution trace if exists
      if (pendingResponse.trace_id) {
        const { error: traceError } = await supabase.from('q_execution_traces')
          .update({
            status: 'completed',
            completed_at: now,
          })
          .eq('trace_id', pendingResponse.trace_id);
        
        if (traceError) {
          console.warn('[openai-webhook] Failed to update trace:', traceError);
          // Non-critical: continue processing
        }
      }
      
      console.log('[openai-webhook] Response completed:', responseId, 'output length:', outputText.length);
      break;
    }
    
    case 'response.failed':
    case 'response.cancelled':
    case 'response.incomplete': {
      const status = type.split('.')[1];
      const errorMessage = data.error?.message || `Response ${status}`;
      
      // PHASE 1 FIX: Update pending response with error handling
      const { error: pendingUpdateError } = await supabase.from('q_pending_responses')
        .update({
          status,
          error: errorMessage,
          error_code: data.error?.code || null,
          completed_at: now,
          webhook_event_id: eventId,
        })
        .eq('row_id', pendingResponse.row_id);
      
      if (pendingUpdateError) {
        console.error('[openai-webhook] Failed to update pending response on failure:', pendingUpdateError);
        return new Response('Internal Server Error', { status: 500 });
      }
      
      // Mark trace as failed
      if (pendingResponse.trace_id) {
        const { error: traceError } = await supabase.from('q_execution_traces')
          .update({
            status: 'failed',
            error_summary: errorMessage,
            completed_at: now,
          })
          .eq('trace_id', pendingResponse.trace_id);
        
        if (traceError) {
          console.warn('[openai-webhook] Failed to update trace on failure:', traceError);
          // Non-critical: continue processing
        }
      }
      
      console.log('[openai-webhook] Response', status, ':', responseId);
      break;
    }
    
    default:
      console.warn('[openai-webhook] Unknown event type:', type);
  }
  
  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
});
