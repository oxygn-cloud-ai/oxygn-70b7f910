import { buildTree } from '../utils/positionUtils';

export const fetchPrompts = async (supabase, currentUserId = null) => {
  try {
    if (!import.meta.env.VITE_PROMPTS_TBL) {
      throw new Error('VITE_PROMPTS_TBL environment variable is not set');
    }

    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('is_deleted', false)
      .order('position');

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

    // Add owner display info to all top-level prompts
    const promptsWithOwnerInfo = (data || []).map(prompt => {
      if (!prompt.parent_row_id && prompt.owner_id) {
        const ownerInfo = ownerProfiles.get(prompt.owner_id) || { display: prompt.owner_id.substring(0, 8), avatar: null };
        return {
          ...prompt,
          showOwner: true,
          ownerDisplay: ownerInfo.display,
          ownerAvatar: ownerInfo.avatar
        };
      }
      return prompt;
    });

    return buildTree(promptsWithOwnerInfo);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '') => {
  try {
    // Get the current timestamp for a unique name
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .insert([{
        parent_row_id: parentId,
        input_admin_prompt: defaultAdminPrompt,
        is_deleted: false,
        prompt_name: `New Prompt ${timestamp}` // Add a default prompt name
      }])
      .select()
      .single();

    if (error) throw error;
    return data.row_id;
  } catch (error) {
    console.error('Error adding prompt:', error);
    throw error;
  }
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