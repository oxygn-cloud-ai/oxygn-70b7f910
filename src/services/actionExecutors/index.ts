/**
 * Action Executors Registry
 * 
 * Central registry for all post-action executors.
 * Each executor handles a specific action type and performs the necessary operations
 * after an AI response is received.
 */

import { 
  ExecutorFunction, 
  ExecutorParams, 
  ExecutorResult,
  TypedSupabaseClient,
  PromptRow,
  ActionConfig,
  ExecutionContext
} from './types';

import { executeCreateChildrenJson } from './createChildrenJson';
import { executeCreateChildrenSections } from './createChildrenSections';
import { executeCreateChildrenText } from './createChildrenText';
import { executeCreateTemplate } from './createTemplate';
import { processVariableAssignments } from './processVariableAssignments';
import { trackEvent, trackException } from '@/lib/posthog';

// Re-export for convenience
export { processVariableAssignments };

// Registry of action executors
const executors: Record<string, ExecutorFunction> = {
  create_children_text: executeCreateChildrenText,
  create_children_json: executeCreateChildrenJson,
  create_children_sections: executeCreateChildrenSections,
  create_template: executeCreateTemplate,
};

/**
 * Execute a post-action for an action node
 */
export const executePostAction = async ({
  supabase,
  prompt,
  jsonResponse,
  actionId,
  config,
  context = {},
}: ExecutorParams): Promise<ExecutorResult> => {
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
      actionId,
      config,
      context,
    });

    trackEvent('post_action_executed', { action_id: actionId, success: true });

    return {
      success: true,
      ...result,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Action execution failed';
    console.error(`Error executing action ${actionId}:`, error);
    trackException(error instanceof Error ? error : new Error(errorMessage), { 
      context: 'executePostAction', 
      action_id: actionId 
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Register a new action executor
 * Allows dynamic registration of new action types
 */
export const registerExecutor = (actionId: string, executorFn: ExecutorFunction): void => {
  if (executors[actionId]) {
    console.warn(`Overwriting existing executor for: ${actionId}`);
  }
  executors[actionId] = executorFn;
};

/**
 * Check if an executor exists for an action type
 */
export const hasExecutor = (actionId: string): boolean => {
  return !!executors[actionId];
};

// Re-export types for convenience
export type { 
  ExecutorFunction, 
  ExecutorParams, 
  ExecutorResult,
  TypedSupabaseClient,
  PromptRow,
  ActionConfig,
  ExecutionContext
} from './types';

export default executePostAction;
