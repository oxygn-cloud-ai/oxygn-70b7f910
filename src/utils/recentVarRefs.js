/**
 * Utilities for managing recently used variable references
 * Stored in localStorage under 'qonsol_recent_var_refs'
 */

const STORAGE_KEY = 'qonsol_recent_var_refs';
const MAX_RECENT = 5;

/**
 * Get recently used variable references
 * @returns {Array<{promptId: string, promptName: string, field: string}>}
 */
export const getRecentVarRefs = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    // Validate structure
    return parsed.filter(item => 
      item && 
      typeof item.promptId === 'string' &&
      typeof item.promptName === 'string' &&
      typeof item.field === 'string'
    ).slice(0, MAX_RECENT);
  } catch (err) {
    console.warn('Error reading recent var refs:', err);
    return [];
  }
};

/**
 * Add a variable reference to recent list
 * @param {string} promptId - The prompt UUID
 * @param {string} promptName - The prompt name for display
 * @param {string} field - The field key (e.g., 'output_response')
 */
export const addRecentVarRef = (promptId, promptName, field) => {
  try {
    const current = getRecentVarRefs();
    
    // Remove existing entry for same promptId + field combo
    const filtered = current.filter(
      item => !(item.promptId === promptId && item.field === field)
    );
    
    // Add new entry at the beginning
    const updated = [
      { promptId, promptName, field },
      ...filtered,
    ].slice(0, MAX_RECENT);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving recent var ref:', err);
  }
};

/**
 * Clear all recent variable references
 */
export const clearRecentVarRefs = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Error clearing recent var refs:', err);
  }
};

/**
 * Build the reference string from components
 */
export const buildRefString = (promptId, field) => {
  return `{{q.ref[${promptId}].${field}}}`;
};

/**
 * Field labels for display
 */
export const FIELD_LABELS = {
  output_response: 'AI Response',
  user_prompt_result: 'User Prompt Result',
  input_admin_prompt: 'System Prompt',
  input_user_prompt: 'User Prompt',
  prompt_name: 'Name',
};

/**
 * Get display label for a field
 */
export const getFieldLabel = (field) => {
  return FIELD_LABELS[field] || field;
};
