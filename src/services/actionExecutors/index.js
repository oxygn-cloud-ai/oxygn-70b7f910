/**
 * Action Executors Registry
 * 
 * Central dispatcher for executing post-actions after AI responses.
 * Each executor is a separate module for maintainability.
 */

import { executeCreateChildrenText } from './createChildrenText';
import { executeCreateChildrenJson } from './createChildrenJson';
import { executeCreateChildrenSections } from './createChildrenSections';
import { executeCreateTemplate } from './createTemplate';
import { processVariableAssignments } from './processVariableAssignments';
import { trackEvent, trackException } from '@/lib/posthog';

// Re-export for convenience
export { processVariableAssignments };

/**
 * Registry of action executors
 * Maps action type IDs to their executor functions
 */
const executors = {
  create_children_text: executeCreateChildrenText,
  create_children_json: executeCreateChildrenJson,
  create_children_sections: executeCreateChildrenSections,
  create_template: executeCreateTemplate,
};

/**
 * Execute a post-action for an action node
 * 
 * @param {object} params - Execution parameters
 * @param {object} params.supabase - Supabase client
 * @param {object} params.prompt - The prompt/node that executed
 * @param {object} params.jsonResponse - Parsed JSON response from AI
 * @param {string} params.actionId - Action type ID
 * @param {object} params.config - Action configuration
 * @param {object} params.context - Additional context (user, project, etc.)
 * @returns {Promise<object>} - Execution result
 */
export const executePostAction = async ({
  supabase,
  prompt,
  jsonResponse,
  actionId,
  config,
  context = {},
}) => {
  const executor = executors[actionId];
  
  if (!executor) {
    console.warn(`No executor found for action type: ${actionId}`);
    return {
      success: false,
      error: `Unknown action type: ${actionId}`,
    };
  }

  try {
    const result = await executor({
      supabase,
      prompt,
      jsonResponse,
      config,
      context,
    });

    trackEvent('post_action_executed', { action_id: actionId, success: true });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error(`Error executing action ${actionId}:`, error);
    trackException(error, { context: 'executePostAction', action_id: actionId });
    return {
      success: false,
      error: error.message || 'Action execution failed',
    };
  }
};

/**
 * Register a new action executor
 * Allows dynamic registration of new action types
 */
export const registerExecutor = (actionId, executorFn) => {
  if (executors[actionId]) {
    console.warn(`Overwriting existing executor for: ${actionId}`);
  }
  executors[actionId] = executorFn;
};

/**
 * Check if an executor exists for an action type
 */
export const hasExecutor = (actionId) => {
  return !!executors[actionId];
};

export default executePostAction;
