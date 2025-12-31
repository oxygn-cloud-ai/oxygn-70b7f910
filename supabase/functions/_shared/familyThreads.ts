// Shared helpers for unified prompt family thread management
// All prompts in a family (root + descendants) share ONE thread for conversation memory

import { TABLES } from "./tables.ts";

/**
 * Resolve the root prompt ID by walking up the parent chain
 * This ensures all prompts in a family use the same thread
 */
export async function resolveRootPromptId(
  supabase: any, 
  promptRowId: string
): Promise<string> {
  let current = promptRowId;
  let depth = 0;
  const maxDepth = 15;

  while (depth < maxDepth) {
    const { data: prompt } = await supabase
      .from(TABLES.PROMPTS)
      .select('parent_row_id')
      .eq('row_id', current)
      .single();

    if (!prompt?.parent_row_id) {
      return current; // This is the root
    }
    current = prompt.parent_row_id;
    depth++;
  }

  console.warn('Max depth reached resolving root prompt, using:', current);
  return current;
}

/**
 * Get or create the unified family thread for a prompt hierarchy
 * Returns: { row_id, last_response_id, created: boolean }
 */
export async function getOrCreateFamilyThread(
  supabase: any,
  rootPromptRowId: string,
  ownerId: string,
  promptName?: string
): Promise<{ row_id: string; last_response_id: string | null; created: boolean }> {
  // Try to find existing active thread for this family
  const { data: existing, error: findError } = await supabase
    .from(TABLES.THREADS)
    .select('row_id, last_response_id')
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .maybeSingle();

  if (findError) {
    console.error('Error finding family thread:', findError);
  }

  if (existing) {
    console.log('Found existing family thread:', existing.row_id, 'last_response_id:', existing.last_response_id);
    return { ...existing, created: false };
  }

  // Create new thread for this family
  const threadName = promptName 
    ? `${promptName} - ${new Date().toLocaleDateString()}`
    : `Conversation - ${new Date().toLocaleDateString()}`;

  // Use a temporary placeholder for openai_conversation_id - will be updated with real response_id
  const tempConversationId = `pending-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const { data: newThread, error: createError } = await supabase
    .from(TABLES.THREADS)
    .insert({
      root_prompt_row_id: rootPromptRowId,
      owner_id: ownerId,
      name: threadName,
      is_active: true,
      openai_conversation_id: tempConversationId,
    })
    .select('row_id, last_response_id')
    .single();

  if (createError) {
    console.error('Failed to create family thread:', createError);
    throw new Error('Failed to create conversation thread');
  }

  console.log('Created new family thread:', newThread.row_id, 'for root:', rootPromptRowId);
  return { ...newThread, created: true };
}

/**
 * Update the family thread after an API response
 * Stores the response_id for conversation chaining
 */
export async function updateFamilyThreadResponse(
  supabase: any,
  threadRowId: string,
  responseId: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.THREADS)
    .update({
      last_response_id: responseId,
      last_message_at: new Date().toISOString(),
      openai_conversation_id: responseId, // Store actual response ID for reference
    })
    .eq('row_id', threadRowId);

  if (error) {
    console.error('Failed to update thread response:', error);
  } else {
    console.log('Updated family thread with response_id for context chaining:', responseId);
  }
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
  ownerId: string
): Promise<{ row_id: string; last_response_id: string | null } | null> {
  const { data, error } = await supabase
    .from(TABLES.THREADS)
    .select('row_id, last_response_id')
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error getting family thread:', error);
    return null;
  }

  return data;
}
