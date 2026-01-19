/**
 * Variables Tool Module
 * Tools for managing prompt variables within a family
 * Includes communication tools for interactive Q&A
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';
import { TABLES } from '../tables.ts';

const TOOL_NAMES = [
  'create_variable',
  'update_variable',
  'delete_variable',
  'ask_user_question',
  'store_qa_response',
  'complete_communication'
] as const;

type VariableToolName = typeof TOOL_NAMES[number];

// Variable name validation (matches frontend rules in variableResolver.js)
const SYSTEM_VARIABLE_PREFIX = 'q.';
const VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const MAX_VARIABLE_NAME_LENGTH = 50;

function validateVariableName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Variable name is required' };
  }
  
  if (name.startsWith(SYSTEM_VARIABLE_PREFIX)) {
    return { valid: false, error: 'Cannot use reserved prefix "q."' };
  }
  
  if (!VARIABLE_NAME_PATTERN.test(name)) {
    return { valid: false, error: 'Variable name must start with a letter and contain only letters, numbers, underscores, and hyphens' };
  }
  
  if (name.length > MAX_VARIABLE_NAME_LENGTH) {
    return { valid: false, error: `Variable name must be ${MAX_VARIABLE_NAME_LENGTH} characters or less` };
  }
  
  return { valid: true };
}

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
      },
      // Communication tools for interactive Q&A
      {
        type: 'function',
        name: 'ask_user_question',
        description: 'Ask the user a question in a popup dialog. The user\'s response will be stored as a variable. Use this in communication prompts to gather information interactively. Variable names MUST start with ai_ prefix.',
        parameters: {
          type: 'object',
          properties: {
            variable_name: {
              type: 'string',
              description: 'Variable name to store the answer (MUST start with ai_)'
            },
            question: {
              type: 'string',
              description: 'The question to display to the user'
            },
            description: {
              type: ['string', 'null'],
              description: 'Optional context about what this information will be used for'
            }
          },
          required: ['variable_name', 'question', 'description'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'store_qa_response',
        description: 'Store a Q&A pair from a communication session as a persistent variable. Call this after receiving the user\'s answer to persist it.',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The prompt to store the variable on'
            },
            variable_name: {
              type: 'string',
              description: 'Variable name (must start with ai_)'
            },
            question: {
              type: 'string',
              description: 'The question that was asked'
            },
            answer: {
              type: 'string',
              description: 'The user\'s response'
            },
            description: {
              type: ['string', 'null'],
              description: 'Description of what this variable is for'
            }
          },
          required: ['prompt_row_id', 'variable_name', 'question', 'answer', 'description'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'complete_communication',
        description: 'Signal that information gathering is complete. Call this when you have collected all needed information from the user.',
        parameters: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Brief summary of the information collected'
            }
          },
          required: ['summary'],
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
    
    const { familyPromptIds, promptRowId } = familyContext;

    try {
      switch (toolName) {
        case 'create_variable': {
          const { prompt_row_id, variable_name, variable_value, variable_description, is_required } = args;
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          // Validate variable name
          const validation = validateVariableName(variable_name);
          if (!validation.valid) {
            return JSON.stringify({ error: validation.error });
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
            .maybeSingle();

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
            .maybeSingle();

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
              // Validate variable_name if being updated
              if (field === 'variable_name') {
                const validation = validateVariableName(updates[field]);
                if (!validation.valid) {
                  return JSON.stringify({ error: validation.error });
                }
                // Check for duplicate name on this prompt
                const { data: existing } = await supabase
                  .from(TABLES.PROMPT_VARIABLES)
                  .select('row_id')
                  .eq('prompt_row_id', variable.prompt_row_id)
                  .eq('variable_name', updates[field])
                  .neq('row_id', variable_row_id)
                  .limit(1);
                
                if (existing && existing.length > 0) {
                  return JSON.stringify({ error: `Variable "${updates[field]}" already exists on this prompt` });
                }
              }
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
            .maybeSingle();

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

        // Communication tools
        case 'ask_user_question': {
          const { variable_name, question, description } = args;
          
          // Auto-add ai_ prefix if missing
          let finalVariableName = variable_name;
          if (!variable_name.startsWith('ai_')) {
            finalVariableName = `ai_${variable_name}`;
          }
          
          // Validate the variable name
          const validation = validateVariableName(finalVariableName);
          if (!validation.valid) {
            return JSON.stringify({ error: validation.error });
          }
          
          // Return special interrupt marker - the frontend will handle this
          return JSON.stringify({
            __interrupt: 'user_input_required',
            variable_name: finalVariableName,
            question,
            description: description || null
          });
        }

        case 'store_qa_response': {
          const { prompt_row_id, variable_name, question, answer, description } = args;
          
          // Validate ai_ prefix
          if (!variable_name.startsWith('ai_')) {
            return JSON.stringify({ error: 'Variable name must start with ai_ prefix for communication variables' });
          }
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }
          
          // Validate variable name
          const validation = validateVariableName(variable_name);
          if (!validation.valid) {
            return JSON.stringify({ error: validation.error });
          }
          
          // Check for existing variable with this name
          const { data: existing } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .select('row_id')
            .eq('prompt_row_id', prompt_row_id)
            .eq('variable_name', variable_name)
            .limit(1);
          
          if (existing && existing.length > 0) {
            // Update existing variable
            const { error: updateError } = await supabase
              .from(TABLES.PROMPT_VARIABLES)
              .update({
                variable_value: answer,
                source_question: question,
                source_type: 'communication',
                variable_description: description || question,
                updated_at: new Date().toISOString()
              })
              .eq('row_id', existing[0].row_id);
            
            if (updateError) {
              console.error('Update QA variable error:', updateError);
              return JSON.stringify({ error: 'Failed to update variable' });
            }
            
            return JSON.stringify({
              success: true,
              message: `Updated {{${variable_name}}} with answer`,
              row_id: existing[0].row_id
            });
          }
          
          // Create new variable
          const { data: newVar, error: insertError } = await supabase
            .from(TABLES.PROMPT_VARIABLES)
            .insert({
              prompt_row_id,
              variable_name,
              variable_value: answer,
              variable_description: description || question,
              source_question: question,
              source_type: 'communication'
            })
            .select('row_id')
            .maybeSingle();
          
          if (insertError || !newVar) {
            console.error('Create QA variable error:', insertError);
            return JSON.stringify({ error: 'Failed to create variable' });
          }
          
          return JSON.stringify({
            success: true,
            message: `Created {{${variable_name}}} with answer`,
            row_id: newVar.row_id
          });
        }

        case 'complete_communication': {
          const { summary } = args;
          
          return JSON.stringify({
            success: true,
            message: 'Communication session completed',
            summary
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
