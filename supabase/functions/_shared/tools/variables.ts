/**
 * Variables Tool Module
 * Tools for managing prompt variables within a family
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';
import { TABLES } from '../tables.ts';

const TOOL_NAMES = [
  'create_variable',
  'update_variable',
  'delete_variable'
] as const;

type VariableToolName = typeof TOOL_NAMES[number];

export const variablesModule: ToolModule = {
  id: 'variables',
  name: 'Variables',
  version: '1.0.0',
  scopes: ['family'],
  requires: [],

  getTools(context: ToolContext): ToolDefinition[] {
    return [
      {
        type: 'function',
        name: 'create_variable',
        description: 'Create a new variable on a prompt in this family.',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The row_id of the prompt to add the variable to'
            },
            variable_name: {
              type: 'string',
              description: 'Name of the variable (use {{variable_name}} syntax in prompts)'
            },
            variable_value: {
              type: ['string', 'null'],
              description: 'Default value for the variable (null for no default)'
            },
            variable_description: {
              type: ['string', 'null'],
              description: 'Description of what this variable is for (null to skip)'
            },
            is_required: {
              type: ['boolean', 'null'],
              description: 'Whether this variable must have a value (default: false, null for default)'
            }
          },
          required: ['prompt_row_id', 'variable_name', 'variable_value', 'variable_description', 'is_required'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'update_variable',
        description: 'Update an existing variable in this family. Pass null for fields you do not want to change.',
        parameters: {
          type: 'object',
          properties: {
            variable_row_id: {
              type: 'string',
              description: 'The row_id of the variable to update'
            },
            variable_name: {
              type: ['string', 'null'],
              description: 'New name for the variable (null to keep current)'
            },
            variable_value: {
              type: ['string', 'null'],
              description: 'New value for the variable (null to keep current)'
            },
            variable_description: {
              type: ['string', 'null'],
              description: 'New description for the variable (null to keep current)'
            },
            is_required: {
              type: ['boolean', 'null'],
              description: 'Whether this variable is required (null to keep current)'
            }
          },
          required: ['variable_row_id', 'variable_name', 'variable_value', 'variable_description', 'is_required'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'delete_variable',
        description: 'Delete a variable from a prompt in this family.',
        parameters: {
          type: 'object',
          properties: {
            variable_row_id: {
              type: 'string',
              description: 'The row_id of the variable to delete'
            }
          },
          required: ['variable_row_id'],
          additionalProperties: false
        },
        strict: true
      }
    ];
  },

  handles(toolName: string): boolean {
    return TOOL_NAMES.includes(toolName as VariableToolName);
  },

  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const { supabase, familyContext } = context;
    
    if (!familyContext) {
      return JSON.stringify({ error: 'Family context required for variable tools' });
    }
    
    const { familyPromptIds } = familyContext;

    try {
      switch (toolName) {
        case 'create_variable': {
          const { prompt_row_id, variable_name, variable_value, variable_description, is_required } = args;
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          // Check for duplicate variable name on this prompt
          const { data: existing } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .select('row_id')
            .eq('prompt_row_id', prompt_row_id)
            .eq('variable_name', variable_name)
            .limit(1);

          if (existing && existing.length > 0) {
            return JSON.stringify({ error: `Variable "${variable_name}" already exists on this prompt` });
          }

          const { data: newVar, error: insertError } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .insert({
              prompt_row_id,
              variable_name,
              variable_value: variable_value || null,
              variable_description: variable_description || null,
              is_required: is_required || false
            })
            .select('row_id, variable_name')
            .single();

          if (insertError || !newVar) {
            console.error('Create variable error:', insertError);
            return JSON.stringify({ error: 'Failed to create variable' });
          }

          return JSON.stringify({
            success: true,
            message: `Created variable "{{${newVar.variable_name}}}"`,
            row_id: newVar.row_id
          });
        }

        case 'update_variable': {
          const { variable_row_id, ...updates } = args;
          
          // Get the variable and verify it belongs to a prompt in this family
          const { data: variable, error: varError } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .select('prompt_row_id, variable_name')
            .eq('row_id', variable_row_id)
            .single();

          if (varError || !variable) {
            return JSON.stringify({ error: 'Variable not found' });
          }

          if (!familyPromptIds.includes(variable.prompt_row_id)) {
            return JSON.stringify({ error: 'Variable does not belong to a prompt in this family' });
          }

          // Build update object - filter out null values (null means "don't change")
          const updateData: Record<string, any> = {};
          const allowedFields = ['variable_name', 'variable_value', 'variable_description', 'is_required'];
          
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
            .from(TABLES.PROMPT_VARIABLES)
            .update(updateData)
            .eq('row_id', variable_row_id);

          if (updateError) {
            console.error('Update variable error:', updateError);
            return JSON.stringify({ error: 'Failed to update variable' });
          }

          return JSON.stringify({
            success: true,
            message: `Updated variable "${variable.variable_name}"`,
            updated_fields: Object.keys(updateData)
          });
        }

        case 'delete_variable': {
          const { variable_row_id } = args;
          
          // Get the variable and verify it belongs to a prompt in this family
          const { data: variable, error: varError } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .select('prompt_row_id, variable_name')
            .eq('row_id', variable_row_id)
            .single();

          if (varError || !variable) {
            return JSON.stringify({ error: 'Variable not found' });
          }

          if (!familyPromptIds.includes(variable.prompt_row_id)) {
            return JSON.stringify({ error: 'Variable does not belong to a prompt in this family' });
          }

          const { error: deleteError } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .delete()
            .eq('row_id', variable_row_id);

          if (deleteError) {
            console.error('Delete variable error:', deleteError);
            return JSON.stringify({ error: 'Failed to delete variable' });
          }

          return JSON.stringify({
            success: true,
            message: `Deleted variable "{{${variable.variable_name}}}"`
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
