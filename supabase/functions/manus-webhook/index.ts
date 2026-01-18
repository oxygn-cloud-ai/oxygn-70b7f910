import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { ERROR_CODES, mapManusStopReasonToErrorCode, mapManusStopReasonToStatus } from "../_shared/errorCodes.ts";

// In-memory cache for public key
let cachedPublicKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 3600000; // 1 hour

async function getManusPublicKey(): Promise<string> {
  if (cachedPublicKey && Date.now() < cacheExpiry) {
    return cachedPublicKey;
  }
  
  console.log('[manus-webhook] Fetching public key from Manus API...');
  const response = await fetch('https://api.manus.ai/v1/webhook/public_key');
  
  if (!response.ok) {
    throw new Error('Failed to fetch Manus public key');
  }
  
  const data = await response.json();
  cachedPublicKey = data.public_key;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  console.log('[manus-webhook] Public key cached');
  return cachedPublicKey!;
}

function extractProjectRef(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }
  // Extract project ref from URL: https://<project-ref>.supabase.co
  const url = new URL(supabaseUrl);
  return url.hostname.split('.')[0];
}

async function verifySignature(
  req: Request,
  body: string
): Promise<boolean> {
  const signature = req.headers.get('X-Webhook-Signature');
  const timestampStr = req.headers.get('X-Webhook-Timestamp');
  
  if (!signature || !timestampStr) {
    console.error('[manus-webhook] Missing signature headers');
    return false;
  }
  
  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);
  
  // Reject if timestamp is more than 5 minutes old
  if (Math.abs(now - timestamp) > 300) {
    console.error('[manus-webhook] Timestamp outside acceptable range:', { timestamp, now });
    return false;
  }
  
  try {
    // Construct the signature string
    const projectRef = extractProjectRef();
    const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/manus-webhook`;
    
    const bodyBytes = new TextEncoder().encode(body);
    const bodyHash = await crypto.subtle.digest('SHA-256', bodyBytes);
    const bodyHashHex = Array.from(new Uint8Array(bodyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const signatureString = `${timestamp}.${webhookUrl}.${bodyHashHex}`;
    
    const publicKeyPem = await getManusPublicKey();
    
    // Parse PEM and import key
    const pemContents = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const publicKey = await crypto.subtle.importKey(
      'spki',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature from base64
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    
    // Verify
    const signatureContentBytes = new TextEncoder().encode(signatureString);
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      signatureContentBytes
    );
    
    return isValid;
  } catch (error) {
    console.error('[manus-webhook] Signature verification error:', error);
    // Invalidate cache on verification failure
    cachedPublicKey = null;
    return false;
  }
}

serve(async (req) => {
  // Read body once for both verification and parsing
  const body = await req.text();
  
  // Verify signature
  const skipVerification = Deno.env.get('MANUS_SKIP_SIGNATURE_VERIFICATION') === 'true';
  
  if (!skipVerification) {
    const isValid = await verifySignature(req, body);
    if (!isValid) {
      console.error('[manus-webhook] Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('[manus-webhook] Signature verification skipped (dev mode)');
  }
  
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (e) {
    console.error('[manus-webhook] Invalid JSON payload');
    return new Response('Bad Request', { status: 400 });
  }
  
  const { event_type, task_id, ...eventData } = payload;
  
  console.log('[manus-webhook] Received event:', { event_type, task_id });
  
  // Use service role for database operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Idempotency check
  const eventId = payload.event_id || `${task_id}-${event_type}-${Date.now()}`;
  const { data: existing } = await supabase
    .from('q_manus_tasks')
    .select('task_id, processed_at')
    .eq('task_id', task_id)
    .maybeSingle();
  
  if (existing?.processed_at && event_type === 'task_stopped') {
    console.log('[manus-webhook] Event already processed, skipping');
    return new Response('OK', { status: 200 });
  }
  
  switch (event_type) {
    case 'task_created': {
      await supabase
        .from('q_manus_tasks')
        .update({
          status: 'running',
          task_title: eventData.title,
          task_url: eventData.task_url,
        })
        .eq('task_id', task_id);
      console.log('[manus-webhook] Task marked as running:', task_id);
      break;
    }
    
    case 'task_progress': {
      // Manus may send progress updates
      console.log('[manus-webhook] Task progress:', task_id, eventData);
      break;
    }
    
    case 'task_stopped': {
      const { stop_reason, result, attachments } = eventData;
      
      // Use centralized mapping functions
      const newStatus = mapManusStopReasonToStatus(stop_reason);
      const errorCode = mapManusStopReasonToErrorCode(stop_reason);
      const isSuccess = stop_reason === 'finish';
      const requiresInput = stop_reason === 'ask';
      
      console.log('[manus-webhook] Task stopped:', { 
        task_id, 
        stop_reason, 
        newStatus, 
        error_code: errorCode,
        isSuccess, 
        requiresInput 
      });
      
      // Update task record with error_code
      const { error: updateError } = await supabase
        .from('q_manus_tasks')
        .update({
          status: newStatus,
          result_message: result?.message || (typeof result === 'string' ? result : null),
          attachments: attachments || [],
          stop_reason,
          requires_input: requiresInput,
          input_prompt: requiresInput ? eventData.ask_prompt : null,
          completed_at: isSuccess ? new Date().toISOString() : null,
          processed_at: new Date().toISOString(),
          webhook_event_id: eventId,
          error_code: errorCode,  // Include structured error code
        })
        .eq('task_id', task_id);
      
      if (updateError) {
        console.error('[manus-webhook] Error updating task:', updateError);
      }
      
      // If completed, update the prompt's output_response
      if (isSuccess) {
        const { data: task } = await supabase
          .from('q_manus_tasks')
          .select('prompt_row_id, trace_id')
          .eq('task_id', task_id)
          .maybeSingle();
        
        if (task?.prompt_row_id) {
          const resultText = result?.message || (typeof result === 'string' ? result : '');
          await supabase
            .from('q_prompts')
            .update({
              output_response: resultText,
              user_prompt_result: resultText,
              updated_at: new Date().toISOString(),
            })
            .eq('row_id', task.prompt_row_id);
          console.log('[manus-webhook] Updated prompt output:', task.prompt_row_id);
        }
        
        // Complete execution trace if exists
        if (task?.trace_id) {
          await supabase
            .from('q_execution_traces')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('trace_id', task.trace_id);
          console.log('[manus-webhook] Completed trace:', task.trace_id);
        }
      }
      break;
    }
    
    default:
      console.warn('[manus-webhook] Unknown event type:', event_type);
  }
  
  return new Response('OK', { status: 200 });
});
