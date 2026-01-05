/**
 * Prompts Tool Module
 * Tools for reading and managing prompts within a family
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';
import { TABLES } from '../tables.ts';
import { getPromptFamilyTree } from '../promptFamily.ts';

const TOOL_NAMES = [
  'get_prompt_tree',
  'get_prompt_details',
  // list_family_files, read_file_content - moved to files.ts module
  // list_family_confluence, read_confluence_page - moved to confluence.ts module
  'list_family_variables',
  'list_json_schemas',
  'get_json_schema_details',
  // Write operations
  'create_prompt',
  'update_prompt',
  'delete_prompt',
  'duplicate_prompt',
  // Execution operations
  'run_prompt',
  'run_cascade'
] as const;

type PromptToolName = typeof TOOL_NAMES[number];

// getFamilyFiles moved to files.ts module
// getFamilyConfluencePages moved to confluence.ts module

/**
 * Get variables from all prompts in the family
 */
async function getFamilyVariables(supabase: any, familyPromptIds: string[]): Promise<any[]> {
  const { data, error } = await supabase
    .from(TABLES.PROMPT_VARIABLES)
    .select('row_id, prompt_row_id, variable_name, variable_value, variable_description, is_required')
    .in('prompt_row_id', familyPromptIds);

  if (error) {
    console.error('Error fetching family variables:', error);
    return [];
  }
  return data || [];
}

/**
 * Get JSON schemas used by any prompt in the family
 */
async function getFamilyJsonSchemas(supabase: any, familyPromptIds: string[]): Promise<any[]> {
  const { data: prompts } = await supabase
    .from(TABLES.PROMPTS)
    .select('json_schema_template_id')
    .in('row_id', familyPromptIds)
    .not('json_schema_template_id', 'is', null);

  if (!prompts || prompts.length === 0) return [];

  const schemaIds = [...new Set(prompts.map((p: any) => p.json_schema_template_id))];

  const { data: schemas, error } = await supabase
    .from(TABLES.JSON_SCHEMA_TEMPLATES)
    .select('row_id, schema_name, schema_description, json_schema, action_config, child_creation')
    .in('row_id', schemaIds);

  if (error) {
    console.error('Error fetching family schemas:', error);
    return [];
  }
  return schemas || [];
}

// ============================================================================
// EXECUTION HELPERS - For run_prompt and run_cascade tools
// ============================================================================

interface ParsedSSEResult {
  success: boolean;
  response?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: string;
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string, 
  options: RequestInit, 
  timeoutMs: number = 120000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Small delay between operations to prevent rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseSSEResponse(sseText: string): ParsedSSEResult {
  const lines = sseText.split('\n');
  let result: ParsedSSEResult = { success: false, error: 'No response received' };
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('data:')) continue;
    
    const data = line.replace(/^data:\s?/, '').trim();
    if (!data || data === '[DONE]') continue;
    
    try {
      const event = JSON.parse(data);
      if (event.type === 'complete') {
        result = {
          success: event.success !== false,
          response: event.response || '',
          usage: event.usage,
        };
      }
      if (event.type === 'error') {
        result = { success: false, error: event.error || 'Unknown error' };
      }
    } catch {
      // Skip non-JSON lines
    }
  }
  return result;
}

async function resolvePromptId(
  supabase: any,
  userId: string,
  promptId: string | null,
  promptName: string | null,
  familyPromptIds?: string[]
): Promise<{ row_id: string; prompt_name: string } | { error: string }> {
  if (promptId) {
    const { data: prompt } = await supabase
      .from(TABLES.PROMPTS)
      .select('row_id, prompt_name, owner_id')
      .eq('row_id', promptId)
      .eq('is_deleted', false)
      .maybeSingle();
    
    if (!prompt) return { error: `Prompt ID "${promptId}" not found` };
    if (prompt.owner_id !== userId) return { error: 'Access denied' };
    if (familyPromptIds && !familyPromptIds.includes(promptId)) {
      return { error: 'Prompt not in current family' };
    }
    return { row_id: prompt.row_id, prompt_name: prompt.prompt_name };
  }
  
  if (promptName) {
    const { data: prompts } = await supabase
      .from(TABLES.PROMPTS)
      .select('row_id, prompt_name, owner_id')
      .ilike('prompt_name', promptName)
      .eq('owner_id', userId)
      .eq('is_deleted', false);
    
    if (!prompts || prompts.length === 0) {
      return { error: `Prompt "${promptName}" not found` };
    }
    if (prompts.length > 1) {
      const names = prompts.map((p: any) => p.prompt_name).join(', ');
      return { error: `Multiple prompts match "${promptName}": ${names}. Use prompt_id instead.` };
    }
    return { row_id: prompts[0].row_id, prompt_name: prompts[0].prompt_name };
  }
  
  return { error: 'Either prompt_id or prompt_name required' };
}

async function fetchCascadeHierarchy(
  supabase: any, 
  topLevelRowId: string,
  maxDepth: number = 10
): Promise<{ levels: { level: number; prompts: any[] }[]; totalPrompts: number } | null> {
  const levels: { level: number; prompts: any[] }[] = [];
  let currentLevelIds = [topLevelRowId];
  let allPrompts: any[] = [];

  const { data: topPrompt } = await supabase
    .from(TABLES.PROMPTS).select('*')
    .eq('row_id', topLevelRowId).eq('is_deleted', false).maybeSingle();

  if (!topPrompt) return null;

  levels.push({ level: 0, prompts: [topPrompt] });
  allPrompts.push(topPrompt);

  let levelNum = 1;
  while (currentLevelIds.length > 0 && levelNum <= maxDepth) {
    const { data: children } = await supabase
      .from(TABLES.PROMPTS).select('*')
      .in('parent_row_id', currentLevelIds)
      .eq('is_deleted', false)
      .order('position', { ascending: true });

    if (!children?.length) break;

    levels.push({ level: levelNum, prompts: children });
    allPrompts = [...allPrompts, ...children];
    currentLevelIds = children.map((c: any) => c.row_id);
    levelNum++;
  }

  return { levels, totalPrompts: allPrompts.length };
}

export const promptsModule: ToolModule = {
  id: 'prompts',
  name: 'Prompts',
  version: '1.0.0',
  scopes: ['family'],
  requires: [],

  getTools(context: ToolContext): ToolDefinition[] {
    return [
      {
        type: 'function',
        name: 'get_prompt_tree',
        description: 'Get the hierarchical tree structure of this prompt family, showing all prompts from root to leaves with their relationships and key properties.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'get_prompt_details',
        description: 'Get detailed information about a specific prompt including its system prompt, user prompt, output, model settings, and variables.',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The row_id of the prompt to get details for'
            }
          },
          required: ['prompt_row_id'],
          additionalProperties: false
        },
        strict: true
      },
      // list_family_files, read_file_content - moved to files.ts module
      // list_family_confluence, read_confluence_page - moved to confluence.ts module
      {
        type: 'function',
        name: 'list_family_variables',
        description: 'List all variables defined on prompts in this family.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'list_json_schemas',
        description: 'List JSON schemas used by prompts in this family.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'get_json_schema_details',
        description: 'Get the full JSON schema definition and configuration for a specific schema.',
        parameters: {
          type: 'object',
          properties: {
            schema_row_id: {
              type: 'string',
              description: 'The row_id of the schema to get details for'
            }
          },
          required: ['schema_row_id'],
          additionalProperties: false
        },
        strict: true
      },
      // Write operations
      {
        type: 'function',
        name: 'create_prompt',
        description: 'Create a new child prompt under an existing prompt in this family. Returns the new prompt row_id.',
        parameters: {
          type: 'object',
          properties: {
            parent_row_id: {
              type: 'string',
              description: 'The row_id of the parent prompt to create the child under'
            },
            prompt_name: {
              type: 'string',
              description: 'Name for the new prompt'
            },
            input_admin_prompt: {
              type: ['string', 'null'],
              description: 'System/admin prompt content (optional, pass null to skip)'
            },
            input_user_prompt: {
              type: ['string', 'null'],
              description: 'User prompt content (optional, pass null to skip)'
            },
            node_type: {
              type: ['string', 'null'],
              enum: ['standard', 'action', null],
              description: 'Type of prompt node (default: standard, pass null for default)'
            }
          },
          required: ['parent_row_id', 'prompt_name', 'input_admin_prompt', 'input_user_prompt', 'node_type'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'update_prompt',
        description: 'Update fields of an existing prompt in this family. Pass null for fields you do not want to update.',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The row_id of the prompt to update'
            },
            prompt_name: {
              type: ['string', 'null'],
              description: 'New name for the prompt (null to keep current)'
            },
            input_admin_prompt: {
              type: ['string', 'null'],
              description: 'New system/admin prompt content (null to keep current)'
            },
            input_user_prompt: {
              type: ['string', 'null'],
              description: 'New user prompt content (null to keep current)'
            },
            note: {
              type: ['string', 'null'],
              description: 'Note/documentation for the prompt (null to keep current)'
            },
            model: {
              type: ['string', 'null'],
              description: 'Model to use (e.g., gpt-4o, gpt-4o-mini) (null to keep current)'
            }
          },
          required: ['prompt_row_id', 'prompt_name', 'input_admin_prompt', 'input_user_prompt', 'note', 'model'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'delete_prompt',
        description: 'Soft-delete a prompt and all its children. Use with caution.',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The row_id of the prompt to delete'
            }
          },
          required: ['prompt_row_id'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'duplicate_prompt',
        description: 'Create a copy of an existing prompt (and optionally its children).',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The row_id of the prompt to duplicate'
            },
            include_children: {
              type: ['boolean', 'null'],
              description: 'Whether to also duplicate child prompts (default: false, pass null for default)'
            }
          },
          required: ['prompt_row_id', 'include_children'],
          additionalProperties: false
        },
        strict: true
      },
      // Execution operations
      {
        type: 'function',
        name: 'run_prompt',
        description: 'Execute a single prompt and get its AI-generated output. Use this to run prompts as sub-tasks within the family.',
        parameters: {
          type: 'object',
          properties: {
            prompt_id: {
              type: ['string', 'null'],
              description: 'The UUID of the prompt to execute'
            },
            prompt_name: {
              type: ['string', 'null'],
              description: 'Alternative: find prompt by name (case-insensitive)'
            },
            variables_json: {
              type: ['string', 'null'],
              description: 'Variables to pass as JSON string of key-value pairs, e.g. {"key": "value"}'
            },
            user_message: {
              type: ['string', 'null'],
              description: 'User message to include'
            }
          },
          required: ['prompt_id', 'prompt_name', 'variables_json', 'user_message'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'run_cascade',
        description: 'Execute an entire prompt cascade (parent and all children). Returns aggregated results.',
        parameters: {
          type: 'object',
          properties: {
            prompt_id: {
              type: ['string', 'null'],
              description: 'UUID of root prompt'
            },
            prompt_name: {
              type: ['string', 'null'],
              description: 'Alternative: find root by name'
            },
            variables_json: {
              type: ['string', 'null'],
              description: 'Initial variables as JSON string, e.g. {"key": "value"}'
            },
            max_depth: {
              type: ['integer', 'null'],
              description: 'Max depth (default: 10, max: 50)'
            },
            stop_on_error: {
              type: ['boolean', 'null'],
              description: 'Stop cascade on first prompt failure (default: false - continues all prompts)'
            }
          },
          required: ['prompt_id', 'prompt_name', 'variables_json', 'max_depth', 'stop_on_error'],
          additionalProperties: false
        },
        strict: true
      }
    ];
  },

  handles(toolName: string): boolean {
    return TOOL_NAMES.includes(toolName as PromptToolName);
  },

  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const { supabase, familyContext } = context;
    
    if (!familyContext) {
      return JSON.stringify({ error: 'Family context required for prompt tools' });
    }
    
    const { promptRowId, familyPromptIds, cachedTree } = familyContext;

    try {
      switch (toolName) {
        case 'get_prompt_tree': {
          const tree = cachedTree ?? await getPromptFamilyTree(supabase, promptRowId);
          return JSON.stringify({ message: 'Prompt family tree', tree });
        }

        case 'get_prompt_details': {
          const { prompt_row_id } = args;
          
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          const { data: prompt, error } = await supabase
            .from(TABLES.PROMPTS)
            .select('*')
            .eq('row_id', prompt_row_id)
            .maybeSingle();

          if (error || !prompt) {
            return JSON.stringify({ error: 'Prompt not found' });
          }

          const { data: variables } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .select('variable_name, variable_value, variable_description, is_required')
            .eq('prompt_row_id', prompt_row_id);

          return JSON.stringify({
            name: prompt.prompt_name,
            node_type: prompt.node_type,
            system_prompt: prompt.input_admin_prompt,
            user_prompt: prompt.input_user_prompt,
            output: prompt.output_response,
            model: prompt.model,
            note: prompt.note,
            post_action: prompt.post_action,
            variables: variables || []
          });
        }

        // list_family_files, read_file_content - moved to files.ts module
        // list_family_confluence, read_confluence_page - moved to confluence.ts module

        case 'list_family_variables': {
          const variables = await getFamilyVariables(supabase, familyPromptIds);
          
          const byPrompt: Record<string, any[]> = {};
          for (const v of variables) {
            if (!byPrompt[v.prompt_row_id]) byPrompt[v.prompt_row_id] = [];
            byPrompt[v.prompt_row_id].push(v);
          }

          return JSON.stringify({
            message: `${variables.length} variables across ${Object.keys(byPrompt).length} prompts`,
            variables: byPrompt
          });
        }

        case 'list_json_schemas': {
          const schemas = await getFamilyJsonSchemas(supabase, familyPromptIds);
          return JSON.stringify({
            message: `${schemas.length} JSON schemas used`,
            schemas: schemas.map(s => ({
              row_id: s.row_id,
              name: s.schema_name,
              description: s.schema_description,
              has_action_config: !!s.action_config,
              has_child_creation: !!s.child_creation
            }))
          });
        }

        case 'get_json_schema_details': {
          const { schema_row_id } = args;
          const schemas = await getFamilyJsonSchemas(supabase, familyPromptIds);
          const schema = schemas.find(s => s.row_id === schema_row_id);
          
          if (!schema) {
            return JSON.stringify({ error: 'Schema not found in this family' });
          }

          return JSON.stringify({
            name: schema.schema_name,
            description: schema.schema_description,
            json_schema: schema.json_schema,
            action_config: schema.action_config,
            child_creation: schema.child_creation
          });
        }

        // Write operations
        case 'create_prompt': {
          const { parent_row_id, prompt_name, input_admin_prompt, input_user_prompt, node_type } = args;
          
          // Validate parent is in family
          if (!familyPromptIds.includes(parent_row_id)) {
            return JSON.stringify({ error: 'Parent prompt not in this family' });
          }

          // Get parent to inherit settings
          const { data: parent } = await supabase
            .from(TABLES.PROMPTS)
            .select('model, thread_mode, owner_id')
            .eq('row_id', parent_row_id)
            .maybeSingle();

          // Calculate position (append at end)
          const { data: siblings } = await supabase
            .from(TABLES.PROMPTS)
            .select('position')
            .eq('parent_row_id', parent_row_id)
            .eq('is_deleted', false)
            .order('position', { ascending: false })
            .limit(1);

          const newPosition = (siblings?.[0]?.position ?? 0) + 1;

          // Create the prompt
          const { data: newPrompt, error: insertError } = await supabase
            .from(TABLES.PROMPTS)
            .insert({
              parent_row_id,
              prompt_name,
              input_admin_prompt: input_admin_prompt || null,
              input_user_prompt: input_user_prompt || null,
              node_type: node_type || 'standard',
              model: parent?.model || 'gpt-4o',
              thread_mode: parent?.thread_mode || 'inherit',
              owner_id: context.userId,
              position: newPosition,
              is_deleted: false
            })
            .select('row_id, prompt_name')
            .single();

          if (insertError || !newPrompt) {
            console.error('Create prompt error:', insertError);
            return JSON.stringify({ error: 'Failed to create prompt' });
          }

          return JSON.stringify({
            success: true,
            message: `Created prompt "${newPrompt.prompt_name}"`,
            row_id: newPrompt.row_id
          });
        }

        case 'update_prompt': {
          const { prompt_row_id, ...updates } = args;
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          // Filter out null/undefined values and build update object
          const updateData: Record<string, any> = {};
          const allowedFields = ['prompt_name', 'input_admin_prompt', 'input_user_prompt', 'note', 'model'];
          
          for (const field of allowedFields) {
            if (updates[field] !== undefined && updates[field] !== null) {
              updateData[field] = updates[field];
            }
          }

          if (Object.keys(updateData).length === 0) {
            return JSON.stringify({ error: 'No valid fields to update. Pass non-null values for fields you want to change.' });
          }

          updateData.updated_at = new Date().toISOString();

          const { error: updateError } = await supabase
            .from(TABLES.PROMPTS)
            .update(updateData)
            .eq('row_id', prompt_row_id);

          if (updateError) {
            console.error('Update prompt error:', updateError);
            return JSON.stringify({ error: 'Failed to update prompt' });
          }

          return JSON.stringify({
            success: true,
            message: `Updated prompt with fields: ${Object.keys(updateData).join(', ')}`,
            updated_fields: Object.keys(updateData)
          });
        }

        case 'delete_prompt': {
          const { prompt_row_id } = args;
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          // Don't allow deleting the root prompt
          const { data: prompt } = await supabase
            .from(TABLES.PROMPTS)
            .select('parent_row_id, prompt_name')
            .eq('row_id', prompt_row_id)
            .maybeSingle();

          if (!prompt) {
            return JSON.stringify({ error: 'Prompt not found' });
          }
          if (!prompt.parent_row_id) {
            return JSON.stringify({ error: 'Cannot delete root prompt. Delete the entire family from the UI instead.' });
          }

          // Soft delete the prompt and all children
          const { error: deleteError } = await supabase
            .from(TABLES.PROMPTS)
            .update({ is_deleted: true, updated_at: new Date().toISOString() })
            .eq('row_id', prompt_row_id);

          if (deleteError) {
            console.error('Delete prompt error:', deleteError);
            return JSON.stringify({ error: 'Failed to delete prompt' });
          }

          // Also soft-delete children (recursive via parent_row_id)
          const childIds = familyPromptIds.filter(id => {
            const p = familyContext.promptsMap?.get(id);
            return p?.parent_row_id === prompt_row_id;
          });

          if (childIds.length > 0) {
            await supabase
              .from(TABLES.PROMPTS)
              .update({ is_deleted: true, updated_at: new Date().toISOString() })
              .in('row_id', childIds);
          }

          return JSON.stringify({
            success: true,
            message: `Deleted prompt "${prompt.prompt_name}" and ${childIds.length} children`
          });
        }

        case 'duplicate_prompt': {
          const { prompt_row_id, include_children } = args;
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          // Get the source prompt
          const { data: source, error: sourceError } = await supabase
            .from(TABLES.PROMPTS)
            .select('*')
            .eq('row_id', prompt_row_id)
            .maybeSingle();

          if (sourceError || !source) {
            return JSON.stringify({ error: 'Source prompt not found' });
          }

          // Calculate new position
          const { data: siblings } = await supabase
            .from(TABLES.PROMPTS)
            .select('position')
            .eq('parent_row_id', source.parent_row_id)
            .eq('is_deleted', false)
            .order('position', { ascending: false })
            .limit(1);

          const newPosition = (siblings?.[0]?.position ?? 0) + 1;

          // Create the duplicate
          const { row_id: _oldId, created_at: _created, updated_at: _updated, ...copyData } = source;
          
          const { data: newPrompt, error: insertError } = await supabase
            .from(TABLES.PROMPTS)
            .insert({
              ...copyData,
              prompt_name: `${source.prompt_name} (copy)`,
              position: newPosition,
              owner_id: context.userId
            })
            .select('row_id, prompt_name')
            .single();

          if (insertError || !newPrompt) {
            console.error('Duplicate prompt error:', insertError);
            return JSON.stringify({ error: 'Failed to duplicate prompt' });
          }

          let childCount = 0;
          if (include_children) {
            // Get direct children from the family
            const children = familyPromptIds.filter(id => {
              const p = familyContext.promptsMap?.get(id);
              return p?.parent_row_id === prompt_row_id;
            });

            for (const childId of children) {
              const { data: childSource } = await supabase
                .from(TABLES.PROMPTS)
                .select('*')
                .eq('row_id', childId)
                .maybeSingle();

              if (childSource) {
                const { row_id: _cid, created_at: _cc, updated_at: _cu, ...childCopy } = childSource;
                await supabase.from(TABLES.PROMPTS).insert({
                  ...childCopy,
                  parent_row_id: newPrompt.row_id,
                  owner_id: context.userId
                });
                childCount++;
              }
            }
          }

          return JSON.stringify({
            success: true,
            message: `Duplicated "${source.prompt_name}" as "${newPrompt.prompt_name}"${include_children ? ` with ${childCount} children` : ''}`,
            row_id: newPrompt.row_id
          });
        }

        // ============================================================================
        // EXECUTION OPERATIONS
        // ============================================================================

        case 'run_prompt': {
          const { prompt_id, prompt_name, variables_json, user_message } = args;
          
          // Parse variables from JSON string
          let variables: Record<string, any> = {};
          if (variables_json) {
            try {
              variables = JSON.parse(variables_json);
            } catch (e) {
              return JSON.stringify({ error: `Invalid variables_json: ${e instanceof Error ? e.message : 'parse error'}` });
            }
          }
          
          if (!context.accessToken) {
            return JSON.stringify({ error: 'accessToken not available for prompt execution' });
          }
          
          // Validate SUPABASE_URL is configured
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
          if (!SUPABASE_URL) {
            console.error('run_prompt: SUPABASE_URL environment variable not set');
            return JSON.stringify({ error: 'Server configuration error: SUPABASE_URL not configured' });
          }
          
          const resolved = await resolvePromptId(supabase, context.userId, prompt_id, prompt_name, familyPromptIds);
          if ('error' in resolved) return JSON.stringify({ error: resolved.error });
          
          // Recursion check
          const executionStack = context.executionStack || [];
          if (executionStack.includes(resolved.row_id)) {
            return JSON.stringify({ error: `Recursion detected: "${resolved.prompt_name}" already executing` });
          }
          
          console.log(`run_prompt: Executing "${resolved.prompt_name}" (${resolved.row_id})`);
          // Note: Recursion prevention is limited to single-level - nested AI tool calls not tracked across edge function boundaries
          
          try {
            const response = await fetchWithTimeout(
              `${SUPABASE_URL}/functions/v1/conversation-run`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${context.accessToken}`,
                },
                body: JSON.stringify({
                  child_prompt_row_id: resolved.row_id,
                  user_message: user_message || 'Execute this prompt',
                  template_variables: variables || {},
                  store_in_history: false,
                  thread_mode: 'new',
                }),
              },
              120000 // 2 minute timeout for single prompt
            );
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('run_prompt: conversation-run failed:', response.status, errorText);
              return JSON.stringify({ error: `Execution failed: ${response.status}`, details: errorText.substring(0, 300) });
            }
            
            const sseText = await response.text();
            const result = parseSSEResponse(sseText);
            
            return JSON.stringify({
              prompt_id: resolved.row_id,
              prompt_name: resolved.prompt_name,
              success: result.success,
              output: result.response,
              usage: result.usage,
              error: result.error,
            });
          } catch (fetchError: any) {
            console.error('run_prompt: Fetch error:', fetchError);
            
            // Translate AbortError to user-friendly timeout message
            if (fetchError.name === 'AbortError') {
              return JSON.stringify({ 
                error: `Prompt execution timed out after 2 minutes`,
                prompt_name: resolved.prompt_name,
                suggestion: 'The prompt may be too complex or the model is overloaded. Try again or simplify the prompt.',
                timed_out: true
              });
            }
            
            return JSON.stringify({ error: `Failed: ${fetchError.message}` });
          }
        }

        case 'run_cascade': {
          const { prompt_id, prompt_name, variables_json, max_depth, stop_on_error } = args;
          
          // Parse variables from JSON string
          let variables: Record<string, any> = {};
          if (variables_json) {
            try {
              variables = JSON.parse(variables_json);
            } catch (e) {
              return JSON.stringify({ error: `Invalid variables_json: ${e instanceof Error ? e.message : 'parse error'}` });
            }
          }
          
          if (!context.accessToken) {
            return JSON.stringify({ error: 'accessToken not available for cascade execution' });
          }
          
          // Validate SUPABASE_URL is configured
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
          if (!SUPABASE_URL) {
            console.error('run_cascade: SUPABASE_URL environment variable not set');
            return JSON.stringify({ error: 'Server configuration error: SUPABASE_URL not configured' });
          }
          
          const resolved = await resolvePromptId(supabase, context.userId, prompt_id, prompt_name, familyPromptIds);
          if ('error' in resolved) return JSON.stringify({ error: resolved.error });
          
          const effectiveMaxDepth = Math.min(Math.max(max_depth || 10, 1), 50);
          const hierarchy = await fetchCascadeHierarchy(supabase, resolved.row_id, effectiveMaxDepth);
          
          if (!hierarchy) return JSON.stringify({ error: 'No prompts found' });
          
          console.log(`run_cascade: Starting "${resolved.prompt_name}" with ${hierarchy.totalPrompts} prompts`);
          
          const results: any[] = [];
          const accumulatedVars = { ...(variables || {}) };
          let lastOutput = '';
          let cascadeStopped = false;
          let stoppedReason = '';
          
          // Calculate total prompts for determining if this is the last one
          let processedCount = 0;
          const totalToProcess = hierarchy.levels.reduce((acc, level) => 
            acc + level.prompts.filter(p => !p.exclude_from_cascade).length, 0);
          
          outerLoop:
          for (const level of hierarchy.levels) {
            for (const prompt of level.prompts) {
              if (prompt.exclude_from_cascade) {
                results.push({ prompt_id: prompt.row_id, prompt_name: prompt.prompt_name, skipped: true, reason: 'exclude_from_cascade' });
                continue;
              }
              
              processedCount++;
              const isLastPrompt = processedCount >= totalToProcess;
              
              try {
                const response = await fetchWithTimeout(
                  `${SUPABASE_URL}/functions/v1/conversation-run`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${context.accessToken}`,
                    },
                    body: JSON.stringify({
                      child_prompt_row_id: prompt.row_id,
                      user_message: 'Execute this prompt',
                      template_variables: accumulatedVars,
                      store_in_history: false,
                      thread_mode: 'new',
                    }),
                  },
                  180000 // 3 minute timeout per prompt in cascade
                );
                
                // Check HTTP status before parsing
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`run_cascade: HTTP ${response.status} for "${prompt.prompt_name}":`, errorText);
                  
                  results.push({
                    prompt_id: prompt.row_id,
                    prompt_name: prompt.prompt_name,
                    level: level.level,
                    success: false,
                    error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
                  });
                  
                  if (stop_on_error) {
                    cascadeStopped = true;
                    stoppedReason = `HTTP ${response.status} at "${prompt.prompt_name}"`;
                    break outerLoop;
                  }
                  
                  // Add delay before next prompt (rate limiting prevention)
                  if (!isLastPrompt) await delay(500);
                  continue;
                }
                
                const parsed = parseSSEResponse(await response.text());
                results.push({
                  prompt_id: prompt.row_id,
                  prompt_name: prompt.prompt_name,
                  level: level.level,
                  success: parsed.success,
                  output: parsed.response?.substring(0, 1000),
                  error: parsed.error,
                });
                
                if (parsed.success && parsed.response) {
                  lastOutput = parsed.response;
                  accumulatedVars['cascade_previous_response'] = parsed.response;
                  accumulatedVars[`output_${prompt.row_id}`] = parsed.response;
                }
                
                // Check if we should stop on error
                if (!parsed.success && stop_on_error) {
                  cascadeStopped = true;
                  stoppedReason = `Error at "${prompt.prompt_name}": ${parsed.error || 'Unknown error'}`;
                  break outerLoop;
                }
                
                // Add delay between prompts to prevent rate limiting (except after last prompt)
                if (!isLastPrompt) {
                  await delay(500);
                }
              } catch (fetchError: any) {
                console.error(`run_cascade: Error executing "${prompt.prompt_name}":`, fetchError);
                
                // Translate AbortError to user-friendly timeout message
                const errorMessage = fetchError.name === 'AbortError' 
                  ? `Timed out after 3 minutes`
                  : fetchError.message;
                
                results.push({
                  prompt_id: prompt.row_id,
                  prompt_name: prompt.prompt_name,
                  level: level.level,
                  success: false,
                  error: errorMessage,
                  timed_out: fetchError.name === 'AbortError',
                });
                
                if (stop_on_error) {
                  cascadeStopped = true;
                  stoppedReason = `${errorMessage} at "${prompt.prompt_name}"`;
                  break outerLoop;
                }
                
                // Add delay before next prompt
                if (!isLastPrompt) await delay(500);
              }
            }
          }
          
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success && !r.skipped).length;
          const skipCount = results.filter(r => r.skipped).length;
          
          console.log(`run_cascade: Completed. Success: ${successCount}, Failed: ${failCount}, Skipped: ${skipCount}${cascadeStopped ? ', Stopped early' : ''}`);
          
          // Limit output size for large cascades to avoid response size issues
          const MAX_RESULTS_WITH_OUTPUT = 20;
          const limitedResults = results.map((r, idx) => ({
            ...r,
            output: idx < MAX_RESULTS_WITH_OUTPUT ? r.output : (r.output ? '[output omitted - cascade too large]' : undefined)
          }));
          
          return JSON.stringify({
            cascade_root: resolved.row_id,
            cascade_root_name: resolved.prompt_name,
            total_prompts: hierarchy.totalPrompts,
            summary: {
              success: successCount,
              failed: failCount,
              skipped: skipCount,
            },
            results: limitedResults,
            final_output: lastOutput?.substring(0, 2000),
            stopped_early: cascadeStopped,
            stopped_reason: stoppedReason || undefined,
          });
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${toolName}` });
      }
    } catch (error) {
      console.error(`Tool ${toolName} error:`, error);
      return JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Tool execution failed' 
      });
    }
  }
};
