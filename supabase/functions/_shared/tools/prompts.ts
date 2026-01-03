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
  'list_family_files',
  'read_file_content',
  'list_family_confluence',
  'read_confluence_page',
  'list_family_variables',
  'list_json_schemas',
  'get_json_schema_details'
] as const;

type PromptToolName = typeof TOOL_NAMES[number];

/**
 * Get files attached to any prompt in the family
 */
async function getFamilyFiles(supabase: any, familyPromptIds: string[]): Promise<any[]> {
  const { data, error } = await supabase
    .from(TABLES.ASSISTANT_FILES)
    .select(`
      row_id,
      original_filename,
      mime_type,
      file_size,
      upload_status,
      storage_path,
      assistant_row_id,
      q_assistants!inner(prompt_row_id)
    `)
    .in('q_assistants.prompt_row_id', familyPromptIds);

  if (error) {
    console.error('Error fetching family files:', error);
    return [];
  }
  return data || [];
}

/**
 * Get Confluence pages attached to any prompt in the family
 */
async function getFamilyConfluencePages(supabase: any, familyPromptIds: string[]): Promise<any[]> {
  const { data, error } = await supabase
    .from(TABLES.CONFLUENCE_PAGES)
    .select('row_id, page_id, page_title, page_url, content_text, sync_status, prompt_row_id')
    .in('prompt_row_id', familyPromptIds);

  if (error) {
    console.error('Error fetching family confluence pages:', error);
    return [];
  }
  return data || [];
}

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
      {
        type: 'function',
        name: 'list_family_files',
        description: 'List all files attached to prompts in this family.',
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
        name: 'read_file_content',
        description: 'Read the text content of an attached file. Only works for text-based files (txt, md, csv, json, etc).',
        parameters: {
          type: 'object',
          properties: {
            file_row_id: {
              type: 'string',
              description: 'The row_id of the file to read'
            }
          },
          required: ['file_row_id'],
          additionalProperties: false
        },
        strict: true
      },
      {
        type: 'function',
        name: 'list_family_confluence',
        description: 'List all Confluence pages attached to prompts in this family.',
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
        name: 'read_confluence_page',
        description: 'Read the synced content of an attached Confluence page.',
        parameters: {
          type: 'object',
          properties: {
            page_id: {
              type: 'string',
              description: 'The Confluence page_id to read'
            }
          },
          required: ['page_id'],
          additionalProperties: false
        },
        strict: true
      },
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

        case 'list_family_files': {
          const files = await getFamilyFiles(supabase, familyPromptIds);
          return JSON.stringify({
            message: `${files.length} files attached to this family`,
            files: files.map(f => ({
              row_id: f.row_id,
              filename: f.original_filename,
              mime_type: f.mime_type,
              size: f.file_size,
              status: f.upload_status
            }))
          });
        }

        case 'read_file_content': {
          const { file_row_id } = args;
          
          const files = await getFamilyFiles(supabase, familyPromptIds);
          const file = files.find((f: any) => f.row_id === file_row_id);
          
          if (!file) {
            return JSON.stringify({ error: 'File not found in this family' });
          }
          
          const textMimeTypes = [
            'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
            'application/json', 'application/xml', 'text/x-markdown'
          ];
          
          const isTextFile = textMimeTypes.some(t => file.mime_type?.startsWith(t)) ||
            file.original_filename?.match(/\.(txt|md|csv|json|xml|html|yml|yaml|log)$/i);
          
          if (!isTextFile) {
            return JSON.stringify({ 
              error: 'Cannot read binary file content. Only text-based files are supported.',
              filename: file.original_filename,
              mime_type: file.mime_type
            });
          }
          
          if (!file.storage_path) {
            return JSON.stringify({ error: 'File has no storage path' });
          }
          
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('assistant-files')
            .download(file.storage_path);
          
          if (downloadError || !fileData) {
            console.error('File download error:', downloadError);
            return JSON.stringify({ error: 'Failed to download file from storage' });
          }
          
          const content = await fileData.text();
          const truncated = content.length > 50000;
          
          return JSON.stringify({
            filename: file.original_filename,
            mime_type: file.mime_type,
            size: file.file_size,
            truncated,
            content: truncated ? content.slice(0, 50000) + '\n\n[Content truncated at 50KB]' : content
          });
        }

        case 'list_family_confluence': {
          const pages = await getFamilyConfluencePages(supabase, familyPromptIds);
          return JSON.stringify({
            message: `${pages.length} Confluence pages attached`,
            pages: pages.map(p => ({
              row_id: p.row_id,
              page_id: p.page_id,
              title: p.page_title,
              url: p.page_url,
              sync_status: p.sync_status
            }))
          });
        }

        case 'read_confluence_page': {
          const { page_id } = args;
          const pages = await getFamilyConfluencePages(supabase, familyPromptIds);
          const page = pages.find(p => p.page_id === page_id);
          
          if (!page) {
            return JSON.stringify({ error: 'Page not found in this family' });
          }

          return JSON.stringify({
            title: page.page_title,
            content: page.content_text || '(Content not synced yet)',
            url: page.page_url
          });
        }

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
