/**
 * Figma Tools Module
 * Provides tools for listing and reading Figma files attached to the prompt family
 */

import type { ToolModule, ToolContext, ToolDefinition } from './types.ts';
import { TABLES } from '../tables.ts';

/**
 * Get Figma files attached to prompts in a family
 */
async function getFamilyFigmaFiles(
  supabase: any,
  promptIds: string[]
): Promise<any[]> {
  if (promptIds.length === 0) return [];

  const { data: files } = await supabase
    .from(TABLES.FIGMA_FILES)
    .select('row_id, prompt_row_id, file_key, file_name, thumbnail_url, version, sync_status, last_synced_at')
    .in('prompt_row_id', promptIds);

  return files || [];
}

/**
 * Figma tools for exploring attached design files
 */
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'list_family_figma_files',
    description: 'List all Figma files attached to prompts in this family. Shows file names, keys, and sync status.',
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
    name: 'read_figma_file',
    description: 'Read the metadata of a Figma file attached to this family.',
    parameters: {
      type: 'object',
      properties: {
        file_key: {
          type: 'string',
          description: 'The Figma file key (from list_family_figma_files)'
        }
      },
      required: ['file_key'],
      additionalProperties: false
    },
    strict: true
  }
];

const TOOL_NAMES = TOOL_DEFINITIONS.map(t => t.name);

/**
 * Handle Figma tool calls
 */
async function handleFigmaCall(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<string> {
  const { supabase, familyContext } = context;
  const familyPromptIds = familyContext?.familyPromptIds;

  if (!supabase) {
    return JSON.stringify({ error: 'Database connection not available' });
  }

  if (!familyPromptIds?.length) {
    return JSON.stringify({ error: 'No family prompt IDs available. This tool only works in family mode.' });
  }

  try {
    switch (toolName) {
      case 'list_family_figma_files': {
        const files = await getFamilyFigmaFiles(supabase, familyPromptIds);
        
        if (files.length === 0) {
          return JSON.stringify({
            message: 'No Figma files attached to this family',
            files: []
          });
        }
        
        return JSON.stringify({
          message: `${files.length} Figma file${files.length === 1 ? '' : 's'} attached`,
          files: files.map(f => ({
            row_id: f.row_id,
            file_key: f.file_key,
            name: f.file_name,
            thumbnail_url: f.thumbnail_url,
            version: f.version,
            sync_status: f.sync_status,
            last_synced_at: f.last_synced_at
          }))
        });
      }

      case 'read_figma_file': {
        const { file_key } = args;
        
        if (!file_key) {
          return JSON.stringify({ error: 'file_key is required' });
        }
        
        const files = await getFamilyFigmaFiles(supabase, familyPromptIds);
        const file = files.find(f => f.file_key === file_key);
        
        if (!file) {
          return JSON.stringify({ 
            error: 'File not found in this family',
            available_files: files.map(f => ({ file_key: f.file_key, name: f.file_name }))
          });
        }

        return JSON.stringify({
          file_key: file.file_key,
          name: file.file_name,
          thumbnail_url: file.thumbnail_url,
          version: file.version,
          sync_status: file.sync_status,
          last_synced_at: file.last_synced_at,
          figma_url: `https://www.figma.com/file/${file.file_key}`
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Figma tool error (${toolName}):`, error);
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to execute Figma tool' 
    });
  }
}

/**
 * Figma Module
 */
export const figmaModule: ToolModule = {
  id: 'figma',
  name: 'Figma Files',
  version: '1.0.0',
  scopes: ['family'],
  requires: [],
  
  getTools: (_context: ToolContext): ToolDefinition[] => {
    return TOOL_DEFINITIONS;
  },
  
  handles: (toolName: string): boolean => {
    return TOOL_NAMES.includes(toolName);
  },
  
  handleCall: handleFigmaCall
};
