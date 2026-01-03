/**
 * Central Tool Registry
 * Manages tool modules, discovery, and execution routing
 */

import type {
  ToolModule,
  ToolDefinition,
  ToolContext,
  ToolScope,
  RegistryOptions,
  RegistryValidationResult
} from './types.ts';

// Import tool modules
import { promptsModule } from './prompts.ts';
import { knowledgeModule } from './knowledge.ts';
import { databaseModule } from './database.ts';

/**
 * All registered tool modules
 * Add new modules here as they are created
 */
const MODULES: ToolModule[] = [
  promptsModule,
  knowledgeModule,
  databaseModule,
];

// Handler cache for O(1) lookups
const handlerCache = new Map<string, ToolModule>();
let cacheBuilt = false;

/**
 * Build the handler cache for fast tool lookups
 */
function buildHandlerCache(): void {
  if (cacheBuilt) return;
  
  for (const module of MODULES) {
    // Use a dummy context to get tool names
    const dummyContext: ToolContext = {
      supabase: null,
      userId: '',
      credentials: {}
    };
    
    try {
      const tools = module.getTools(dummyContext);
      for (const tool of tools) {
        if (handlerCache.has(tool.name)) {
          console.warn(`Duplicate tool name detected: ${tool.name}`);
        }
        handlerCache.set(tool.name, module);
      }
    } catch (e) {
      // Module may require context to get tools, register via handles() instead
      console.log(`Module ${module.id} requires context for tool discovery`);
    }
  }
  
  cacheBuilt = true;
}

/**
 * Check if a module's credential requirements are met
 */
function hasRequiredCredentials(module: ToolModule, context: ToolContext): boolean {
  for (const cred of module.requires) {
    if (!cred.required) continue;
    
    const value = (context.credentials as any)[cred.key];
    if (!value) {
      return false;
    }
  }
  return true;
}

/**
 * Normalize a tool definition to Responses API format
 * Handles both Chat Completions format (nested) and Responses API format (flat)
 */
export function normalizeToolDefinition(tool: any): ToolDefinition {
  // Already in Responses API format
  if (tool.name && tool.parameters) {
    return {
      type: 'function',
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters,
      ...(tool.strict !== undefined && { strict: tool.strict })
    };
  }
  
  // Chat Completions format (nested under 'function')
  if (tool.function && typeof tool.function === 'object') {
    return {
      type: 'function',
      name: tool.function.name,
      description: tool.function.description || '',
      parameters: tool.function.parameters,
      ...(tool.function.strict !== undefined && { strict: tool.function.strict })
    };
  }
  
  // Unknown format, return as-is and let validation catch it
  return tool;
}

/**
 * Get all tools available for a given scope and context
 */
export function getToolsForScope(
  scope: ToolScope,
  context: ToolContext
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  for (const module of MODULES) {
    // Check scope match
    const scopeMatch = module.scopes.includes(scope) || module.scopes.includes('both');
    if (!scopeMatch) continue;
    
    // Check credentials
    if (!hasRequiredCredentials(module, context)) {
      console.log(`Module ${module.id} skipped - missing required credentials`);
      continue;
    }
    
    // Get and normalize tools
    try {
      const moduleTools = module.getTools(context);
      for (const tool of moduleTools) {
        tools.push(normalizeToolDefinition(tool));
      }
    } catch (e) {
      console.error(`Error getting tools from module ${module.id}:`, e);
    }
  }
  
  return tools;
}

/**
 * Find the module that handles a specific tool
 */
export function findHandler(toolName: string): ToolModule | null {
  // Check cache first
  if (handlerCache.has(toolName)) {
    return handlerCache.get(toolName)!;
  }
  
  // Fallback to handles() check
  for (const module of MODULES) {
    if (module.handles(toolName)) {
      handlerCache.set(toolName, module);
      return module;
    }
  }
  
  return null;
}

/**
 * Execute a tool call by routing to the appropriate module
 */
export async function executeToolCall(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<string> {
  const module = findHandler(toolName);
  
  if (!module) {
    console.error(`No handler found for tool: ${toolName}`);
    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
  
  // Verify credentials before execution
  if (!hasRequiredCredentials(module, context)) {
    return JSON.stringify({ 
      error: `Tool ${toolName} requires credentials that are not available` 
    });
  }
  
  try {
    return await module.handleCall(toolName, args, context);
  } catch (error) {
    console.error(`Tool ${toolName} execution error:`, error);
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Tool execution failed' 
    });
  }
}

/**
 * Validate the registry configuration at startup
 */
export function validateRegistry(): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenTools = new Map<string, string>(); // tool name -> module id
  let toolCount = 0;
  
  // Build cache as part of validation
  buildHandlerCache();
  
  for (const module of MODULES) {
    // Check required fields
    if (!module.id) {
      errors.push(`Module missing id`);
      continue;
    }
    if (!module.name) {
      errors.push(`Module ${module.id} missing name`);
    }
    if (!module.version) {
      warnings.push(`Module ${module.id} missing version`);
    }
    if (!module.scopes || module.scopes.length === 0) {
      errors.push(`Module ${module.id} has no scopes defined`);
    }
    
    // Validate tools
    const dummyContext: ToolContext = {
      supabase: null,
      userId: '',
      credentials: {}
    };
    
    try {
      const tools = module.getTools(dummyContext);
      
      for (const tool of tools) {
        const normalized = normalizeToolDefinition(tool);
        
        if (!normalized.name) {
          errors.push(`Module ${module.id} has tool without name`);
          continue;
        }
        
        // Check for duplicates
        if (seenTools.has(normalized.name)) {
          errors.push(
            `Duplicate tool name "${normalized.name}" in modules ` +
            `${seenTools.get(normalized.name)} and ${module.id}`
          );
        } else {
          seenTools.set(normalized.name, module.id);
          toolCount++;
        }
        
        // Validate handles() consistency
        if (!module.handles(normalized.name)) {
          warnings.push(
            `Module ${module.id} provides tool "${normalized.name}" ` +
            `but handles() returns false for it`
          );
        }
      }
    } catch (e) {
      // Some modules need real context - that's ok
      warnings.push(`Module ${module.id} requires context for tool discovery`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    toolCount,
    moduleCount: MODULES.length
  };
}

/**
 * List all registered modules (for debugging/introspection)
 */
export function listModules(): Array<{
  id: string;
  name: string;
  version: string;
  scopes: ToolScope[];
  requiresCredentials: string[];
}> {
  return MODULES.map(m => ({
    id: m.id,
    name: m.name,
    version: m.version,
    scopes: m.scopes,
    requiresCredentials: m.requires.filter(r => r.required).map(r => r.key)
  }));
}

/**
 * Get a module by ID
 */
export function getModule(moduleId: string): ToolModule | undefined {
  return MODULES.find(m => m.id === moduleId);
}
