/**
 * Tool Registry Types
 * Core interfaces for the modular tool registry architecture
 */

/**
 * Scope determines when a tool is available
 * - 'family': Only when viewing a specific prompt family
 * - 'global': Only when in global chat mode (no prompt selected)
 * - 'both': Available in both modes
 */
export type ToolScope = 'family' | 'global' | 'both';

/**
 * Credential requirements for a tool module
 */
export interface ToolCredential {
  key: string;           // Environment variable or credential key
  required: boolean;     // If true, module is excluded when credential is missing
  description?: string;  // Human-readable description
}

/**
 * Tool definition in Responses API format (flat structure)
 */
export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  strict?: boolean;
}

/**
 * Result of a tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  // Core Supabase access
  supabase: any;
  userId: string;
  
  // Auth token for internal edge function calls (e.g., run_prompt, run_cascade)
  accessToken?: string;
  
  // Recursion prevention - tracks prompt IDs currently being executed
  executionStack?: string[];
  
  // Admin status - checked server-side via is_admin RPC function
  // Determines access to admin-only tools (knowledge management, etc.)
  isAdmin?: boolean;
  
  // Family mode context (populated when scope is 'family')
  familyContext?: {
    promptRowId: string;
    familyPromptIds: string[];
    cachedTree?: any;
    promptsMap?: Map<string, any>;
  };
  
  // Credentials available to tools
  credentials: {
    openAIApiKey?: string;
    githubToken?: string;
    confluenceApiToken?: string;
    confluenceEmail?: string;
    confluenceBaseUrl?: string;
  };
}

/**
 * A tool module that can be registered with the registry
 */
export interface ToolModule {
  // Unique identifier for the module
  id: string;
  
  // Human-readable name
  name: string;
  
  // Version for tracking changes
  version: string;
  
  // Scopes where this module's tools are available
  scopes: ToolScope[];
  
  // Credentials this module requires
  requires: ToolCredential[];
  
  /**
   * Get tool definitions for the Responses API
   * @param context - Current context (for dynamic tool generation)
   * @returns Array of tool definitions
   */
  getTools(context: ToolContext): ToolDefinition[];
  
  /**
   * Handle a tool call
   * @param toolName - The name of the tool being called
   * @param args - Arguments passed to the tool
   * @param context - Current execution context
   * @returns Stringified JSON result
   */
  handleCall(toolName: string, args: any, context: ToolContext): Promise<string>;
  
  /**
   * Check if this module handles a specific tool
   * @param toolName - The tool name to check
   * @returns true if this module handles the tool
   */
  handles(toolName: string): boolean;
}

/**
 * Registry configuration options
 */
export interface RegistryOptions {
  // Enable debug logging
  debug?: boolean;
  
  // Cache handler lookups for performance
  cacheHandlers?: boolean;
}

/**
 * Validation result from registry startup check
 */
export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  toolCount: number;
  moduleCount: number;
}
