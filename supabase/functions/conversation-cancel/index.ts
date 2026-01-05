/**
 * conversation-cancel Edge Function
 * 
 * Cancels an in-progress OpenAI Responses API request.
 * This function is called when users click "Stop" during a prompt run.
 * 
 * POST /conversation-cancel
 * Body: { response_id: "resp_xxx" }
 * 
 * Returns:
 * - { success: true, status: "cancelled" | "completed" | "failed" } on success
 * - { error: "...", error_code: "..." } on failure
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', error_code: 'AUTH_MISSING' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error', error_code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error('Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', error_code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', error_code: 'AUTH_FAILED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { response_id } = await req.json();

    if (!response_id) {
      console.error('Missing response_id in request');
      return new Response(
        JSON.stringify({ error: 'Missing response_id', error_code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate response_id format (should start with resp_)
    if (!response_id.startsWith('resp_')) {
      console.error('Invalid response_id format:', response_id);
      return new Response(
        JSON.stringify({ error: 'Invalid response_id format', error_code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Cancelling OpenAI response:', { response_id, user_email: user.email });

    // Call OpenAI's cancel endpoint
    // POST https://api.openai.com/v1/responses/{response_id}/cancel
    const cancelResponse = await fetch(
      `https://api.openai.com/v1/responses/${response_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Handle response
    if (cancelResponse.ok) {
      const cancelData = await cancelResponse.json();
      console.log('Cancel successful:', { response_id, status: cancelData.status });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: cancelData.status || 'cancelled',
          response_id: cancelData.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle errors
    const errorText = await cancelResponse.text();
    console.error('OpenAI cancel failed:', cancelResponse.status, errorText);

    let errorMessage = 'Failed to cancel response';
    let errorCode = 'CANCEL_FAILED';

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
      
      // Handle specific error cases
      if (cancelResponse.status === 400) {
        // Response may already be completed or in a non-cancellable state
        if (errorMessage.includes('already completed') || errorMessage.includes('cannot be cancelled')) {
          console.log('Response already completed, treating as success:', response_id);
          return new Response(
            JSON.stringify({ 
              success: true, 
              status: 'completed',
              message: 'Response already completed',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        errorCode = 'NOT_CANCELLABLE';
      } else if (cancelResponse.status === 404) {
        errorCode = 'NOT_FOUND';
        errorMessage = 'Response not found or already expired';
      } else if (cancelResponse.status === 429) {
        errorCode = 'RATE_LIMITED';
      }
    } catch {
      // Use raw error text
      errorMessage = errorText || errorMessage;
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage, 
        error_code: errorCode,
      }),
      { 
        status: cancelResponse.status >= 500 ? 500 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in conversation-cancel:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
