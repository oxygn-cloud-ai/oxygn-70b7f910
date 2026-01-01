/**
 * Shared action validation utility
 * Used by both single prompt runs (MainLayout) and cascade runs (useCascadeExecutor)
 */

/**
 * Safely access nested properties in an object using dot notation
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g., 'data.items')
 * @returns {*} The value at the path or undefined
 */
const getNestedValue = (obj, path) => {
  if (!path || path === 'root') return obj;
  return path.split('.').reduce((o, k) => o?.[k], obj);
};

/**
 * Validate an AI response against action requirements
 * @param {Object} jsonResponse - The parsed JSON response from the AI
 * @param {Object} config - The action configuration
 * @param {string} actionId - The action type identifier
 * @returns {Object} Validation result with valid, error, availableArrays, suggestion, itemCount, isEmpty
 */
export const validateActionResponse = (jsonResponse, config, actionId) => {
  // Only validate for actions that need array paths
  if (actionId !== 'create_children_json') {
    return { valid: true };
  }

  // Get the configured JSON path
  const jsonPath = Array.isArray(config?.json_path)
    ? config.json_path[0]
    : (config?.json_path || 'sections');

  // Find the target array
  const targetArray = getNestedValue(jsonResponse, jsonPath);
  
  // Find all available arrays in the response for suggestions
  const availableArrays = Object.keys(jsonResponse || {})
    .filter(k => Array.isArray(jsonResponse[k]));

  // Validate that the path points to an array
  if (!Array.isArray(targetArray)) {
    return {
      valid: false,
      error: `Path "${jsonPath}" is not an array`,
      availableArrays,
      suggestion: availableArrays.length > 0
        ? `Try setting json_path to "${availableArrays[0]}"`
        : 'Ensure the AI response contains an array field',
      valueAtPath: typeof targetArray,
      responseKeys: Object.keys(jsonResponse || {}),
    };
  }

  return {
    valid: true,
    itemCount: targetArray.length,
    isEmpty: targetArray.length === 0,
    jsonPath,
    items: targetArray,
  };
};

/**
 * Extract JSON from a response that may contain markdown code blocks
 * @param {string} response - The raw response string
 * @returns {Object} Parsed JSON object
 * @throws {Error} If JSON parsing fails
 */
export const extractJsonFromResponse = (response) => {
  let jsonString = response.trim();
  
  // Check for markdown code blocks
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }
  
  return JSON.parse(jsonString);
};
