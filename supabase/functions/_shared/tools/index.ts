/**
 * Tool Registry - Main Export
 * 
 * This module provides a modular, extensible tool registry for AI chat functions.
 * 
 * Usage:
 * ```typescript
 * import { getToolsForScope, executeToolCall, validateRegistry } from './_shared/tools/index.ts';
 * 
 * // Get tools for family mode
 * const tools = getToolsForScope('family', context);
 * 
 * // Execute a tool call
 * const result = await executeToolCall('get_prompt_tree', {}, context);
 * 
 * // Validate registry at startup
 * const validation = validateRegistry();
 * if (!validation.valid) {
 *   console.error('Registry errors:', validation.errors);
 * }
 * ```
 */

// Re-export types
export type {
  ToolModule,
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolScope,
  ToolCredential,
  RegistryOptions,
  RegistryValidationResult
} from './types.ts';

// Re-export registry functions
export {
  getToolsForScope,
  executeToolCall,
  findHandler,
  validateRegistry,
  listModules,
  getModule,
  normalizeToolDefinition
} from './registry.ts';

// Re-export individual modules for direct access if needed
export { promptsModule } from './prompts.ts';
export { knowledgeModule } from './knowledge.ts';
export { databaseModule } from './database.ts';
export { variablesModule } from './variables.ts';
export { templatesModule } from './templates.ts';
export { confluenceModule } from './confluence.ts';
export { filesModule } from './files.ts';
export { githubModule } from './github.ts';
