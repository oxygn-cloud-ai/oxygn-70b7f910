import { buildTree } from '../utils/positionUtils';

// Helper to create a conversation/assistant record for a prompt
const createConversationRecord = async (supabase, promptRowId, promptName) => {
  try {
    const insertData = {
      prompt_row_id: promptRowId,
      name: promptName || 'Conversation',
      status: 'active',
      api_version: 'responses',
      use_global_tool_defaults: true,
    };
    
    const { data: conversation, error: createError } = await supabase
      .from(import.meta.env.VITE_ASSISTANTS_TBL)
      .insert([insertData])
      .select()
      .maybeSingle();

    if (createError) {
      console.error('Failed to create conversation record:', createError);
      return null;
    }

    console.log('Auto-created conversation record:', conversation?.row_id);
    return conversation?.row_id;
  } catch (error) {
    console.error('Error in createConversationRecord:', error);
    return null;
  }
};

export const fetchPrompts = async (supabase, currentUserId = null) => {
  try {
    if (!import.meta.env.VITE_PROMPTS_TBL) {
      throw new Error('VITE_PROMPTS_TBL environment variable is not set');
    }

    // Build query with owner_id filter for multi-tenant segregation
    // RLS also enforces this, but we filter client-side for clarity
    let query = supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select(`
        *,
        ${import.meta.env.VITE_ASSISTANTS_TBL}!${import.meta.env.VITE_ASSISTANTS_TBL}_prompt_row_id_fkey(row_id)
      `)
      .eq('is_deleted', false);
    
    // Filter by owner_id if provided (multi-tenant segregation)
    if (currentUserId) {
      query = query.eq('owner_id', currentUserId);
    }
    
    const { data, error } = await query.order('position_lex');

    if (error) throw error;

    // Collect unique owner IDs for all top-level prompts
    const ownerIds = [...new Set(
      (data || [])
        .filter(p => !p.parent_row_id && p.owner_id)
        .map(p => p.owner_id)
    )];

    // Fetch owner profiles from the profiles table
    const ownerProfiles = new Map();
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from(import.meta.env.VITE_PROFILES_TBL || 'profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', ownerIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          ownerProfiles.set(profile.id, {
            display: profile.display_name || profile.email?.split('@')[0] || profile.id.substring(0, 8),
            avatar: profile.avatar_url
          });
        });
      }
    }

    // Find top-level prompts missing assistant records and create them
    const promptsNeedingAssistant = (data || []).filter(prompt => {
      const assistantData = prompt[import.meta.env.VITE_ASSISTANTS_TBL];
      const hasAssistant = Array.isArray(assistantData) 
        ? assistantData.length > 0 
        : !!assistantData;
      // Top-level prompts (no parent) that are marked as assistant but have no record
      return !prompt.parent_row_id && prompt.is_assistant && !hasAssistant;
    });

    // Create missing assistant records in parallel
    const createdAssistants = new Map();
    if (promptsNeedingAssistant.length > 0) {
      console.log(`Creating ${promptsNeedingAssistant.length} missing assistant records...`);
      const creationPromises = promptsNeedingAssistant.map(async (prompt) => {
        const newAssistantId = await createConversationRecord(supabase, prompt.row_id, prompt.prompt_name);
        if (newAssistantId) {
          createdAssistants.set(prompt.row_id, newAssistantId);
        }
      });
      await Promise.all(creationPromises);
    }

    // Add owner display info and extract assistant_row_id
    const promptsWithOwnerInfo = (data || []).map(prompt => {
      // Extract assistant_row_id from the joined data or from newly created
      const assistantData = prompt[import.meta.env.VITE_ASSISTANTS_TBL];
      let assistant_row_id = Array.isArray(assistantData) 
        ? assistantData[0]?.row_id 
        : assistantData?.row_id;
      
      // Use newly created assistant if we just made one
      if (!assistant_row_id && createdAssistants.has(prompt.row_id)) {
        assistant_row_id = createdAssistants.get(prompt.row_id);
      }
      
      // Remove the nested assistant object
      const { [import.meta.env.VITE_ASSISTANTS_TBL]: _, ...promptData } = prompt;
      
      if (!promptData.parent_row_id && promptData.owner_id) {
        const ownerInfo = ownerProfiles.get(promptData.owner_id) || { display: promptData.owner_id.substring(0, 8), avatar: null };
        return {
          ...promptData,
          assistant_row_id,
          showOwner: true,
          ownerDisplay: ownerInfo.display,
          ownerAvatar: ownerInfo.avatar
        };
      }
      return { ...promptData, assistant_row_id };
    });

    return buildTree(promptsWithOwnerInfo);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

/**
 * @deprecated Use addPrompt from promptMutations.js instead.
 * This function is intentionally broken to prevent accidental use.
 * The legacy function was missing owner_id and position_lex which caused RLS failures.
 */
export const addPrompt = async () => {
  throw new Error(
    'promptService.addPrompt is deprecated. Use addPrompt from promptMutations.js instead. ' +
    'The legacy function was missing owner_id and position_lex which caused RLS failures.'
  );
};

export const deletePrompt = async (supabase, itemId) => {
  try {
    const { error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .update({ is_deleted: true })
      .eq('row_id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
};