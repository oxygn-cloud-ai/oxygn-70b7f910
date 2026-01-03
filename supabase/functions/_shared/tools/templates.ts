/**
 * Templates Tool Module
 * Tools for applying and managing JSON schema templates
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';
import { TABLES } from '../tables.ts';

const TOOL_NAMES = [
  'list_available_templates',
  'apply_template',
  'get_template_details'
] as const;

type TemplateToolName = typeof TOOL_NAMES[number];

export const templatesModule: ToolModule = {
  id: 'templates',
  name: 'Templates',
  version: '1.0.0',
  scopes: ['family'],
  requires: [],

  getTools(context: ToolContext): ToolDefinition[] {
    return [
      {
        type: 'function',
        name: 'list_available_templates',
        description: 'List all available JSON schema templates that can be applied to prompts.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: ['string', 'null'],
              description: 'Filter by category (null to list all categories)'
            }
          },
          required: ['category'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'get_template_details',
        description: 'Get full details of a JSON schema template including its schema and configuration.',
        parameters: {
          type: 'object',
          properties: {
            template_row_id: {
              type: 'string',
              description: 'The row_id of the template to get details for'
            }
          },
          required: ['template_row_id'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'apply_template',
        description: 'Apply a JSON schema template to a prompt, configuring its output format and actions.',
        parameters: {
          type: 'object',
          properties: {
            prompt_row_id: {
              type: 'string',
              description: 'The row_id of the prompt to apply the template to'
            },
            template_row_id: {
              type: 'string',
              description: 'The row_id of the template to apply'
            }
          },
          required: ['prompt_row_id', 'template_row_id'],
          additionalProperties: false
        },
        strict: true
      }
    ];
  },

  handles(toolName: string): boolean {
    return TOOL_NAMES.includes(toolName as TemplateToolName);
  },

  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const { supabase, familyContext } = context;
    
    if (!familyContext) {
      return JSON.stringify({ error: 'Family context required for template tools' });
    }
    
    const { familyPromptIds } = familyContext;

    try {
      switch (toolName) {
        case 'list_available_templates': {
          const { category } = args;
          
          let query = supabase
            .from(TABLES.JSON_SCHEMA_TEMPLATES)
            .select('row_id, schema_name, schema_description, category, contributor_display_name')
            .eq('is_deleted', false)
            .or(`is_private.is.false,owner_id.eq.${context.userId}`);

          if (category) {
            query = query.eq('category', category);
          }

          const { data: templates, error } = await query.order('schema_name');

          if (error) {
            console.error('List templates error:', error);
            return JSON.stringify({ error: 'Failed to fetch templates' });
          }

          // Get unique categories
          const categories = [...new Set((templates || []).map((t: any) => t.category).filter(Boolean))];

          return JSON.stringify({
            message: `${templates?.length || 0} templates available`,
            categories,
            templates: (templates || []).map((t: any) => ({
              row_id: t.row_id,
              name: t.schema_name,
              description: t.schema_description,
              category: t.category,
              contributor: t.contributor_display_name
            }))
          });
        }

        case 'get_template_details': {
          const { template_row_id } = args;
          
          const { data: template, error } = await supabase
            .from(TABLES.JSON_SCHEMA_TEMPLATES)
            .select('*')
            .eq('row_id', template_row_id)
            .eq('is_deleted', false)
            .single();

          if (error || !template) {
            return JSON.stringify({ error: 'Template not found' });
          }

          return JSON.stringify({
            name: template.schema_name,
            description: template.schema_description,
            category: template.category,
            contributor: template.contributor_display_name,
            json_schema: template.json_schema,
            action_config: template.action_config,
            node_config: template.node_config,
            model_config: template.model_config,
            child_creation: template.child_creation,
            system_prompt_template: template.system_prompt_template,
            sample_output: template.sample_output
          });
        }

        case 'apply_template': {
          const { prompt_row_id, template_row_id } = args;
          
          // Validate prompt is in family
          if (!familyPromptIds.includes(prompt_row_id)) {
            return JSON.stringify({ error: 'Prompt not in this family' });
          }

          // Get the template
          const { data: template, error: templateError } = await supabase
            .from(TABLES.JSON_SCHEMA_TEMPLATES)
            .select('*')
            .eq('row_id', template_row_id)
            .eq('is_deleted', false)
            .single();

          if (templateError || !template) {
            return JSON.stringify({ error: 'Template not found' });
          }

          // Build update data from template
          const updateData: Record<string, any> = {
            json_schema_template_id: template_row_id,
            updated_at: new Date().toISOString()
          };

          // Apply model config if present
          if (template.model_config) {
            const mc = template.model_config;
            if (mc.model) updateData.model = mc.model;
            if (mc.temperature !== undefined) {
              updateData.temperature = String(mc.temperature);
              updateData.temperature_on = true;
            }
            if (mc.max_tokens !== undefined) {
              updateData.max_tokens = String(mc.max_tokens);
              updateData.max_tokens_on = true;
            }
          }

          // Apply node config if present
          if (template.node_config) {
            const nc = template.node_config;
            if (nc.node_type) updateData.node_type = nc.node_type;
            if (nc.auto_run_children !== undefined) updateData.auto_run_children = nc.auto_run_children;
          }

          // Apply action config if present
          if (template.action_config) {
            updateData.post_action = template.action_config.action_type || null;
            updateData.post_action_config = template.action_config;
          }

          // Apply system prompt template if present
          if (template.system_prompt_template) {
            updateData.input_admin_prompt = template.system_prompt_template;
          }

          // Update the prompt
          const { error: updateError } = await supabase
            .from(TABLES.PROMPTS)
            .update(updateData)
            .eq('row_id', prompt_row_id);

          if (updateError) {
            console.error('Apply template error:', updateError);
            return JSON.stringify({ error: 'Failed to apply template' });
          }

          return JSON.stringify({
            success: true,
            message: `Applied template "${template.schema_name}" to prompt`,
            applied: {
              json_schema: !!template.json_schema,
              model_config: !!template.model_config,
              node_config: !!template.node_config,
              action_config: !!template.action_config,
              system_prompt: !!template.system_prompt_template
            }
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
