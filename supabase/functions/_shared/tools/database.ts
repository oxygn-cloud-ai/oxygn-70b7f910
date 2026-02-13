/**
 * Database Tool Module
 * Tools for inspecting database schema
 */

import type { ToolModule, ToolDefinition, ToolContext } from './types.ts';

const TOOL_NAMES = ['get_database_schema'] as const;

type DatabaseToolName = typeof TOOL_NAMES[number];

// Known tables in the Qonsol database
const KNOWN_TABLES = [
  'q_prompts',
  'q_prompt_variables',
  'q_prompt_library',
  'q_assistants',
  'q_assistant_files',
  'q_threads',
  'q_templates',
  'q_json_schema_templates',
  'q_export_templates',
  'q_confluence_pages',
  'q_models',
  'q_model_defaults',
  'q_settings',
  'q_ai_costs',
  'q_app_knowledge',
  'q_vector_stores',
  'q_prompt_family_threads',
  'q_prompt_family_messages',
  'profiles',
  'projects',
  'resource_shares',
  'user_roles',
  'user_credentials'
];

export const databaseModule: ToolModule = {
  id: 'database',
  name: 'Database Schema',
  version: '1.0.0',
  scopes: ['both'],
  requires: [],

  getTools(context: ToolContext): ToolDefinition[] {
    return [
      {
        type: 'function',
        name: 'get_database_schema',
        description: 'Get information about database tables. Pass null to list all tables, or pass a table name to get column details for that specific table.',
        parameters: {
          type: 'object',
          properties: {
            table_name: {
              type: ['string', 'null'],
              description: 'Specific table name to get column details for, or null to list all tables'
            }
          },
          required: ['table_name'],
          additionalProperties: false
        },
        strict: true
      }
    ];
  },

  handles(toolName: string): boolean {
    return TOOL_NAMES.includes(toolName as DatabaseToolName);
  },

  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const { supabase } = context;

    if (toolName !== 'get_database_schema') {
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    const { table_name } = args;

    try {
      // table_name can be null (list all tables) or a string (get specific table schema)
      if (table_name && typeof table_name === 'string') {
        // Get column names only (no sample data) to avoid data exposure
        const { data: sample, error: sampleError } = await supabase
          .from(table_name)
          .select('*')
          .limit(1);
        
        if (sampleError) {
          return JSON.stringify({ error: `Cannot access table: ${table_name}` });
        }
        
        const inferredColumns = sample && sample[0] 
          ? Object.keys(sample[0]).map(col => ({
              column_name: col,
              data_type: typeof sample[0][col],
            }))
          : [];
        
        return JSON.stringify({
          table: table_name,
          columns: inferredColumns,
          note: 'Column names and types inferred from schema'
        });
      }
      
      // Return list of known tables
      return JSON.stringify({
        tables: KNOWN_TABLES,
        note: 'Use table_name parameter to get column details for a specific table'
      });
    } catch (error) {
      console.error('Database schema error:', error);
      return JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to get schema' 
      });
    }
  }
};
