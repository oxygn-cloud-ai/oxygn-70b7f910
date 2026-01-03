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
  'duplicate_prompt'
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
            .single();

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
            .single();

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
            .single();

          if (!prompt?.parent_row_id) {
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
            .single();

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
                .single();

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
