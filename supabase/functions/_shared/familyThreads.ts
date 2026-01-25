// Shared helpers for unified prompt family thread management
// All prompts in a family (root + descendants) share ONE thread for conversation memory
// Uses OpenAI Conversations API for persistent conversation storage

import { TABLES } from "./tables.ts";

/**
 * Create a new OpenAI conversation
 * Returns the conversation ID (conv_xxx)
 */
export async function createOpenAIConversation(
  apiKey: string,
  metadata?: Record<string, string>
): Promise<string> {
  console.log('Creating new OpenAI conversation...');
  
  const response = await fetch('https://api.openai.com/v1/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ metadata: metadata || {} }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create OpenAI conversation:', error);
    throw new Error(error.error?.message || 'Failed to create conversation');
  }

  const data = await response.json();
  console.log('Created OpenAI conversation:', data.id);
  return data.id; // Returns "conv_xxx"
}

/**
 * Fetch all messages from an OpenAI conversation
 * Returns messages in chronological order
 */
export async function fetchConversationHistory(
  apiKey: string,
  conversationId: string,
  limit: number = 100
): Promise<Array<{ role: string; content: string; created_at: string }>> {
  if (!conversationId?.startsWith('conv_')) {
    console.log('Invalid conversation ID, returning empty:', conversationId);
    return [];
  }

  console.log('Fetching messages from OpenAI conversation:', conversationId);

  const response = await fetch(
    `https://api.openai.com/v1/conversations/${conversationId}/items?limit=${limit}&order=asc`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch conversation history:', await response.text());
    return [];
  }

  const data = await response.json();
  const messages: Array<{ role: string; content: string; created_at: string }> = [];

  for (const item of data.data || []) {
    if (item.type === 'message' && item.role !== 'system' && item.role !== 'developer') {
      let content = '';
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === 'output_text' || part.type === 'input_text' || part.type === 'text') {
            content += part.text || '';
          }
        }
      }
      if (content.trim()) {
        messages.push({
          role: item.role,
          content: content.trim(),
          created_at: item.created_at
            ? new Date(item.created_at * 1000).toISOString()
            : new Date().toISOString(),
        });
      }
    }
  }

  console.log('Fetched conversation history:', messages.length, 'messages');
  return messages;
}

/**
 * Resolve the root prompt ID using the pre-computed root_prompt_row_id column
 * This ensures all prompts in a family use the same thread
 */
export async function resolveRootPromptId(
  supabase: any, 
  promptRowId: string
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLES.PROMPTS)
    .select('root_prompt_row_id, parent_row_id')
    .eq('row_id', promptRowId)
    .maybeSingle();

  if (error) {
    console.error('[resolveRootPromptId] Query failed:', error);
    return promptRowId;  // Fallback to self
  }

  // If root_prompt_row_id is set, use it
  if (data?.root_prompt_row_id) {
    return data.root_prompt_row_id;
  }

  // No parent means this IS the root
  if (!data?.parent_row_id) {
    return promptRowId;
  }

  // Data corruption fallback: root_prompt_row_id is NULL but parent exists
  console.warn('[resolveRootPromptId] Missing root_prompt_row_id:', promptRowId);
  return promptRowId;
}

/**
 * Get or create the unified family thread for a prompt hierarchy
 * Creates a real OpenAI conversation for new threads (for OpenAI provider)
 * Supports multiple providers (OpenAI, Manus, etc.)
 * Returns: { row_id, openai_conversation_id, external_session_id, created: boolean }
 */
export async function getOrCreateFamilyThread(
  supabase: any,
  rootPromptRowId: string,
  ownerId: string,
  promptName?: string,
  openAIApiKey?: string,
  provider: string = 'openai'
): Promise<{ row_id: string; openai_conversation_id: string | null; external_session_id: string | null; last_response_id: string | null; created: boolean }> {
  // Try to find existing active thread for this family AND provider
  const { data: existingThreads, error: findError } = await supabase
    .from(TABLES.THREADS)
    .select('row_id, openai_conversation_id, external_session_id, last_response_id, provider')
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('owner_id', ownerId)
    .eq('provider', provider)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (findError) {
    console.error('Error finding family thread:', findError);
  }

  const existing = existingThreads?.[0] || null;

  if (existing) {
    // Provider-specific validation
    if (provider === 'openai') {
      // OpenAI requires valid conv_ format
      if (existing.openai_conversation_id?.startsWith('conv_')) {
        console.log('Found existing OpenAI family thread:', existing.row_id, 'conversation_id:', existing.openai_conversation_id);
        return { ...existing, created: false };
      }
      // Invalid ID (resp_ or pending-), deactivate and create new
      console.warn('Invalid OpenAI conversation ID found, deactivating thread:', existing.row_id, existing.openai_conversation_id);
      await supabase
        .from(TABLES.THREADS)
        .update({ is_active: false })
        .eq('row_id', existing.row_id);
    } else if (provider === 'manus') {
      // Manus uses external_session_id, no specific format required
      if (existing.external_session_id) {
        console.log('Found existing Manus family thread:', existing.row_id, 'session_id:', existing.external_session_id);
        return { ...existing, created: false };
      }
    } else {
      // For other providers, just return if exists
      console.log(`Found existing ${provider} family thread:`, existing.row_id);
      return { ...existing, created: false };
    }
  }

  // Create new thread for this family
  const threadName = promptName 
    ? `${promptName} - ${new Date().toLocaleDateString()}`
    : `Conversation - ${new Date().toLocaleDateString()}`;

  let conversationId: string | null = null;
  let externalSessionId: string | null = null;

  if (provider === 'openai') {
    // Create real OpenAI conversation if API key provided
    if (openAIApiKey) {
      conversationId = await createOpenAIConversation(openAIApiKey, {
        root_prompt_id: rootPromptRowId,
      });
    } else {
      // Fallback to pending placeholder if no API key (shouldn't happen in normal flow)
      conversationId = `pending-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      console.warn('No API key provided, using placeholder conversation ID');
    }
  } else if (provider === 'manus') {
    // Manus manages sessions internally - we just track our own session ID
    externalSessionId = `manus-${crypto.randomUUID()}`;
    console.log('Creating Manus session:', externalSessionId);
  } else {
    // Generic provider session
    externalSessionId = `${provider}-${crypto.randomUUID()}`;
    console.log(`Creating ${provider} session:`, externalSessionId);
  }

  const { data: newThread, error: createError } = await supabase
    .from(TABLES.THREADS)
    .insert({
      root_prompt_row_id: rootPromptRowId,
      owner_id: ownerId,
      name: threadName,
      is_active: true,
      openai_conversation_id: conversationId,
      external_session_id: externalSessionId,
      provider,
    })
    .select('row_id, openai_conversation_id, external_session_id, last_response_id')
    .maybeSingle();

  if (createError) {
    console.error('Failed to create family thread:', createError);
    throw new Error('Failed to create conversation thread');
  }

  console.log(`Created new ${provider} family thread:`, newThread.row_id);
  return { ...newThread, created: true };
}

/**
 * Clear/reset a family thread (deactivate current, user can create new)
 * Used when user wants to start a fresh conversation
 */
export async function clearFamilyThread(
  supabase: any,
  rootPromptRowId: string,
  ownerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.THREADS)
    .update({ is_active: false })
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('owner_id', ownerId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to clear family thread:', error);
    return false;
  }
  
  console.log('Cleared family thread for root:', rootPromptRowId);
  return true;
}

/**
 * Get the family thread info without creating one
 * Useful for checking if a thread exists
 */
export async function getFamilyThread(
  supabase: any,
  rootPromptRowId: string,
  ownerId: string,
  provider: string = 'openai'
): Promise<{ row_id: string; openai_conversation_id: string | null; external_session_id: string | null; last_response_id: string | null } | null> {
  const { data, error } = await supabase
    .from(TABLES.THREADS)
    .select('row_id, openai_conversation_id, external_session_id, last_response_id')
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('owner_id', ownerId)
    .eq('provider', provider)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error getting family thread:', error);
    return null;
  }

  return data;
}

/**
 * Update the last_response_id for a family thread
 * This is used to chain responses together using previous_response_id
 */
export async function updateFamilyThreadResponseId(
  supabase: any,
  threadRowId: string,
  responseId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.THREADS)
    .update({ 
      last_response_id: responseId,
      last_message_at: new Date().toISOString()
    })
    .eq('row_id', threadRowId);

  if (error) {
    console.error('Failed to update thread response ID:', error);
    return false;
  }
  
  console.log('Updated thread response ID:', threadRowId, '->', responseId);
  return true;
}
