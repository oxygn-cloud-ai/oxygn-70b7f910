/**
 * Context Variable Keys
 * 
 * These are system-computed variables that should NOT be overridden by stored snapshots
 * or frontend-provided template_variables.
 * 
 * IMPORTANT: Keep this in sync with CONTEXT_VARIABLE_KEYS in:
 * - supabase/functions/conversation-run/index.ts (line ~2117)
 * 
 * These variables are authoritative from the backend based on the current execution context.
 */
export const CONTEXT_VARIABLE_KEYS = [
  // Prompt context (current prompt being executed)
  'q.prompt.name',
  'q.prompt.id',
  
  // Parent context (immediate parent of current prompt)
  'q.parent.prompt.name',
  'q.parent.prompt.id',
  'q.parent.output_response',
  'q.parent.user_prompt_result',
  
  // Top-level context (root prompt of cascade/family)
  'q.toplevel.prompt.name',
  
  // User context (from authenticated session)
  'q.user.name',
  'q.user.email',
  
  // Date/time context (computed at runtime)
  'q.today',
  'q.now',
  'q.year',
  'q.month',
  
  // Deprecated keys (kept for backward compatibility)
  'q.policy.name', // DEPRECATED: Use variables instead
];

/**
 * Check if a variable key is a protected context variable
 * @param key - Variable name to check
 * @returns True if this is a protected context variable
 */
export const isContextVariable = (key: string): boolean => CONTEXT_VARIABLE_KEYS.includes(key);

/**
 * Filter out protected context variables from an object
 * @param variables - Object containing variable key-value pairs
 * @returns Filtered object without protected keys
 */
export const filterProtectedVariables = (variables: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!variables || typeof variables !== 'object') return {};
  return Object.fromEntries(
    Object.entries(variables).filter(([key]) => !isContextVariable(key))
  );
};
