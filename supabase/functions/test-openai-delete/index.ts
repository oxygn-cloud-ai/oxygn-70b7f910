import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Phase 0: Test Edge Function to Verify OpenAI DELETE API Behavior
 * 
 * This function tests whether DELETE /v1/responses/{response_id} removes
 * responses from OpenAI conversation history. This is critical to verify
 * before implementing the surgical deletion strategy.
 * 
 * Test sequence:
 * 1. Create a new conversation
 * 2. Send a message and capture the response_id
 * 3. Verify the response exists in conversation items
 * 4. DELETE the response
 * 5. Verify if the response is removed from conversation items
 * 6. Return results with clear verdict
 */

interface TestResult {
  step: string;
  success: boolean;
  details: any;
  error?: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  const results: TestResult[] = [];
  let conversationId: string | null = null;
  let responseId: string | null = null;

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'OPENAI_API_KEY not configured',
        verdict: 'CANNOT_TEST',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Create a new conversation
    console.log('Step 1: Creating conversation...');
    const createConvResponse = await fetch('https://api.openai.com/v1/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: { test: 'delete-api-verification', timestamp: new Date().toISOString() },
      }),
    });

    if (!createConvResponse.ok) {
      const errorText = await createConvResponse.text();
      results.push({
        step: '1. Create conversation',
        success: false,
        details: { status: createConvResponse.status },
        error: errorText,
      });
      throw new Error(`Failed to create conversation: ${errorText}`);
    }

    const conversation = await createConvResponse.json();
    conversationId = conversation.id;
    results.push({
      step: '1. Create conversation',
      success: true,
      details: { conversation_id: conversationId },
    });

    // Step 2: Send a message using Responses API with conversation
    console.log('Step 2: Sending message...');
    const sendResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: 'Say exactly: "TEST_MESSAGE_UNIQUE_12345"',
        conversation: conversationId,
        store_in_history: true, // Explicitly store in history
      }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      results.push({
        step: '2. Send message',
        success: false,
        details: { status: sendResponse.status },
        error: errorText,
      });
      throw new Error(`Failed to send message: ${errorText}`);
    }

    const responseData = await sendResponse.json();
    responseId = responseData.id;
    const responseContent = responseData.output?.[0]?.content?.[0]?.text || 
                           responseData.choices?.[0]?.message?.content || '';
    
    results.push({
      step: '2. Send message',
      success: true,
      details: { response_id: responseId, content_preview: responseContent.substring(0, 100) },
    });

    // Step 3: Verify response exists in conversation items
    console.log('Step 3: Fetching conversation items (before delete)...');
    const beforeItemsResponse = await fetch(
      `https://api.openai.com/v1/conversations/${conversationId}/items`,
      {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      }
    );

    let beforeItems: any[] = [];
    if (beforeItemsResponse.ok) {
      const beforeData = await beforeItemsResponse.json();
      beforeItems = beforeData.data || beforeData.items || [];
      results.push({
        step: '3. Fetch items before delete',
        success: true,
        details: { 
          item_count: beforeItems.length,
          item_ids: beforeItems.map((i: any) => i.id || i.response_id),
        },
      });
    } else {
      // Conversation items API might not exist - this is informative
      const errorText = await beforeItemsResponse.text();
      results.push({
        step: '3. Fetch items before delete',
        success: false,
        details: { status: beforeItemsResponse.status },
        error: `Conversation items API may not be available: ${errorText}`,
      });
    }

    // Step 4: DELETE the response
    console.log('Step 4: Deleting response...');
    const deleteResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    });

    const deleteStatus = deleteResponse.status;
    let deleteBody: any = null;
    try {
      deleteBody = await deleteResponse.json();
    } catch {
      deleteBody = await deleteResponse.text();
    }

    results.push({
      step: '4. DELETE response',
      success: deleteStatus >= 200 && deleteStatus < 300,
      details: { status: deleteStatus, body: deleteBody },
    });

    if (deleteStatus >= 400) {
      throw new Error(`DELETE failed with status ${deleteStatus}`);
    }

    // Step 5: Verify if response is removed from conversation
    console.log('Step 5: Fetching conversation items (after delete)...');
    const afterItemsResponse = await fetch(
      `https://api.openai.com/v1/conversations/${conversationId}/items`,
      {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      }
    );

    let afterItems: any[] = [];
    if (afterItemsResponse.ok) {
      const afterData = await afterItemsResponse.json();
      afterItems = afterData.data || afterData.items || [];
      results.push({
        step: '5. Fetch items after delete',
        success: true,
        details: { 
          item_count: afterItems.length,
          item_ids: afterItems.map((i: any) => i.id || i.response_id),
        },
      });
    } else {
      const errorText = await afterItemsResponse.text();
      results.push({
        step: '5. Fetch items after delete',
        success: false,
        details: { status: afterItemsResponse.status },
        error: errorText,
      });
    }

    // Step 6: Try to send a follow-up message to see if context is affected
    console.log('Step 6: Sending follow-up to test context retention...');
    const followUpResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: 'What was the exact test message I asked you to say in my previous message? Repeat it exactly.',
        conversation: conversationId,
        store_in_history: true,
      }),
    });

    let followUpContent = '';
    if (followUpResponse.ok) {
      const followUpData = await followUpResponse.json();
      followUpContent = followUpData.output?.[0]?.content?.[0]?.text || 
                       followUpData.choices?.[0]?.message?.content || '';
      
      // Check if the model remembers the deleted content
      const remembersContent = followUpContent.includes('TEST_MESSAGE_UNIQUE_12345');
      
      results.push({
        step: '6. Follow-up context test',
        success: true,
        details: { 
          response_preview: followUpContent.substring(0, 200),
          remembers_deleted_content: remembersContent,
        },
      });
    } else {
      results.push({
        step: '6. Follow-up context test',
        success: false,
        details: { status: followUpResponse.status },
        error: await followUpResponse.text(),
      });
    }

    // Analyze results and determine verdict
    const beforeCount = beforeItems.length;
    const afterCount = afterItems.length;
    const itemsRemoved = afterCount < beforeCount;
    const responseIdGone = !afterItems.some((i: any) => 
      i.id === responseId || i.response_id === responseId
    );
    const contextLost = !followUpContent.includes('TEST_MESSAGE_UNIQUE_12345');

    let verdict = 'UNKNOWN';
    let recommendation = '';

    if (responseIdGone && contextLost) {
      verdict = 'DELETE_REMOVES_FROM_HISTORY';
      recommendation = 'Proceed with surgical deletion strategy. DELETE removes responses from conversation history.';
    } else if (responseIdGone && !contextLost) {
      verdict = 'DELETE_OBJECT_ONLY';
      recommendation = 'DELETE only removes the response object, NOT from conversation history. Use fresh-conversation-per-execution strategy instead.';
    } else if (!responseIdGone) {
      verdict = 'DELETE_NO_EFFECT';
      recommendation = 'DELETE has no observable effect on conversation items. Use fresh-conversation-per-execution strategy.';
    }

    return new Response(JSON.stringify({
      success: true,
      test_completed: true,
      verdict,
      recommendation,
      analysis: {
        items_before_delete: beforeCount,
        items_after_delete: afterCount,
        items_removed: itemsRemoved,
        response_id_gone_from_items: responseIdGone,
        context_lost_in_followup: contextLost,
      },
      results,
      cleanup: {
        conversation_id: conversationId,
        note: 'Conversation remains in OpenAI - manual cleanup may be needed',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Test failed:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      results,
      cleanup: {
        conversation_id: conversationId,
        response_id: responseId,
      },
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
