/**
 * Process Variable Assignments from AI Response
 * 
 * Extracts variable name/value pairs from AI JSON responses
 * and updates the prompt's variables accordingly.
 */

import { trackEvent } from '@/lib/posthog';
import { validateVariableName } from '@/utils/variableResolver';

const VARIABLES_TABLE = import.meta.env.VITE_PROMPT_VARIABLES_TBL || 'q_prompt_variables';

/**
 * Get nested value from object using dot notation path
 * @param {object} obj - The object to traverse
 * @param {string} path - Dot-notation path (e.g., "data.variable_assignments")
 * @returns {*} The value at the path, or undefined
 */
const getNestedValue = (obj, path) => {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

/**
 * Process variable assignments from AI response
 * 
 * @param {object} params
 * @param {object} params.supabase - Supabase client
 * @param {string} params.promptRowId - The prompt's row_id
 * @param {object|string} params.jsonResponse - Parsed JSON response from AI (or string to parse)
 * @param {object} params.config - Variable assignments configuration
 * @param {boolean} params.config.enabled - Whether feature is enabled
 * @param {string} params.config.json_path - Path to assignments array (e.g., "variable_assignments")
 * @param {boolean} params.config.auto_create_variables - Whether to create variables that don't exist
 * @returns {Promise<{ processed: number, errors: Array<{name?: string, error: string}> }>}
 */
export const processVariableAssignments = async ({
  supabase,
  promptRowId,
  jsonResponse,
  config,
  onVariablesChanged,
}) => {
  // Early return if not enabled or missing required params
  if (!config?.enabled || !jsonResponse || !promptRowId) {
    return { processed: 0, errors: [] };
  }

  const jsonPath = config.json_path || 'variable_assignments';
  const autoCreate = config.auto_create_variables === true;

  try {
    // Parse JSON if string
    const responseObj = typeof jsonResponse === 'string' 
      ? JSON.parse(jsonResponse) 
      : jsonResponse;

    // Extract assignments array using the configured path
    const assignments = getNestedValue(responseObj, jsonPath);
    
    if (!Array.isArray(assignments)) {
      console.log('processVariableAssignments: No variable assignments array found at path:', jsonPath);
      return { processed: 0, errors: [] };
    }

    if (assignments.length === 0) {
      return { processed: 0, errors: [] };
    }

    // Fetch existing variables for this prompt
    const { data: existingVars, error: fetchError } = await supabase
      .from(VARIABLES_TABLE)
      .select('row_id, variable_name')
      .eq('prompt_row_id', promptRowId);

    if (fetchError) {
      console.error('processVariableAssignments: Error fetching existing variables:', fetchError);
      return { processed: 0, errors: [{ error: `Failed to fetch existing variables: ${fetchError.message}` }] };
    }

    // Build a map of existing variable names to their row_ids
    const existingMap = new Map(
      (existingVars || []).map(v => [v.variable_name, v.row_id])
    );

    let processed = 0;
    const errors = [];

    // Process each assignment
    for (const assignment of assignments) {
      const { name, value } = assignment;
      
      // Validate presence of name
      if (!name || typeof name !== 'string') {
        errors.push({ assignment, error: 'Missing or invalid name field' });
        continue;
      }

      // Validate variable name format
      const validation = validateVariableName(name);
      if (!validation.valid) {
        errors.push({ name, error: validation.error });
        continue;
      }

      const existingRowId = existingMap.get(name);
      const stringValue = String(value ?? '');

      if (existingRowId) {
        // Update existing variable
        const { error: updateError } = await supabase
          .from(VARIABLES_TABLE)
          .update({ 
            variable_value: stringValue,
            updated_at: new Date().toISOString(),
          })
          .eq('row_id', existingRowId);

        if (updateError) {
          errors.push({ name, error: `Update failed: ${updateError.message}` });
        } else {
          processed++;
          console.log(`processVariableAssignments: Updated variable "${name}" = "${stringValue.substring(0, 50)}..."`);
        }
      } else if (autoCreate) {
        // Create new variable
        const { error: insertError } = await supabase
          .from(VARIABLES_TABLE)
          .insert({
            prompt_row_id: promptRowId,
            variable_name: name,
            variable_value: stringValue,
            variable_description: 'Auto-created by AI response',
            is_required: false,
          });

        if (insertError) {
          errors.push({ name, error: `Insert failed: ${insertError.message}` });
        } else {
          processed++;
          console.log(`processVariableAssignments: Created variable "${name}" = "${stringValue.substring(0, 50)}..."`);
        }
      } else {
        // Variable doesn't exist and auto_create is false
        console.log(`processVariableAssignments: Variable "${name}" not found and auto_create_variables is false, skipping`);
      }
    }

    // Track analytics event if any variables were processed
    if (processed > 0) {
      trackEvent('variable_assignments_processed', {
        prompt_id: promptRowId,
        processed_count: processed,
        error_count: errors.length,
        auto_create_enabled: autoCreate,
        json_path: jsonPath,
      });

      // Notify caller that variables changed so they can refresh state
      if (onVariablesChanged) {
        try {
          await onVariablesChanged(promptRowId);
        } catch (callbackError) {
          console.warn('onVariablesChanged callback error:', callbackError);
        }
      }
    }

    return { processed, errors };
  } catch (error) {
    console.error('processVariableAssignments: Error processing variable assignments:', error);
    return { processed: 0, errors: [{ error: error.message }] };
  }
};

export default processVariableAssignments;
