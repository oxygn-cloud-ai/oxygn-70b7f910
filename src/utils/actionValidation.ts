/**
 * Shared action validation utility
 * Used by both single prompt runs (MainLayout) and cascade runs (useCascadeExecutor)
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  availableArrays?: string[];
  suggestion?: string;
  valueAtPath?: string;
  responseKeys?: string[];
  itemCount?: number;
  isEmpty?: boolean;
  jsonPath?: string;
  items?: unknown[];
}

/**
 * Safely access nested properties in an object using dot notation
 * @param obj - The object to traverse
 * @param path - Dot-separated path (e.g., 'data.items')
 * @returns The value at the path or undefined
 */
const getNestedValue = (obj: unknown, path: string): unknown => {
  if (!path || path === 'root') return obj;
  if (typeof obj !== 'object' || obj === null) return undefined;
  
  return path.split('.').reduce<unknown>((o, k) => {
    if (typeof o === 'object' && o !== null && k in o) {
      return (o as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
};

/**
 * Validate an AI response against action requirements
 * @param jsonResponse - The parsed JSON response from the AI
 * @param config - The action configuration
 * @param actionId - The action type identifier
 * @returns Validation result with valid, error, availableArrays, suggestion, itemCount, isEmpty
 */
export const validateActionResponse = (
  jsonResponse: unknown,
  config: Record<string, unknown> | null | undefined,
  actionId: string
): ValidationResult => {
  // Only validate for actions that need array paths
  if (actionId !== 'create_children_json') {
    return { valid: true };
  }

  // Get the configured JSON path
  const configPath = config?.json_path;
  const jsonPath: string = Array.isArray(configPath)
    ? (configPath[0] as string) || 'sections'
    : (typeof configPath === 'string' ? configPath : 'sections');

  // Find the target array
  const targetArray = getNestedValue(jsonResponse, jsonPath);
  
  // Find all available arrays in the response for suggestions
  const responseObj = jsonResponse as Record<string, unknown> | null;
  const availableArrays: string[] = responseObj
    ? Object.keys(responseObj).filter(k => Array.isArray(responseObj[k]))
    : [];

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
      responseKeys: responseObj ? Object.keys(responseObj) : [],
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
 * @param response - The raw response string
 * @returns Parsed JSON object
 * @throws Error if JSON parsing fails
 */
export const extractJsonFromResponse = (response: string): unknown => {
  let jsonString = response.trim();
  
  // Check for markdown code blocks
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  }
  
  return JSON.parse(jsonString);
};

/**
 * Check if a response contains valid JSON
 * @param response - The response string to check
 * @returns True if the response contains valid JSON
 */
export const containsValidJson = (response: string): boolean => {
  try {
    extractJsonFromResponse(response);
    return true;
  } catch {
    return false;
  }
};
