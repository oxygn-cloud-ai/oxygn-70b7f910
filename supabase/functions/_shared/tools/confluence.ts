/**
 * Confluence Tools Module
 * Provides tools for listing and reading Confluence pages attached to the prompt family
 */

import type { ToolModule, ToolContext, ToolDefinition } from './types.ts';
import { TABLES } from '../tables.ts';

/**
 * Get Confluence pages attached to prompts in a family
 */
async function getFamilyConfluencePages(
  supabase: any,
  promptIds: string[]
): Promise<any[]> {
  if (promptIds.length === 0) return [];

  const { data: pages } = await supabase
    .from(TABLES.CONFLUENCE_PAGES)
    .select('row_id, prompt_row_id, page_id, page_title, page_url, content_text, sync_status, space_key, space_name')
    .in('prompt_row_id', promptIds);

  return pages || [];
}

/**
 * Confluence tools for exploring attached documentation
 */
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'list_family_confluence',
    description: 'List all Confluence pages attached to prompts in this family. Shows page titles, URLs, and sync status.',
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
    description: 'Read the full text content of a Confluence page attached to this family.',
    parameters: {
      type: 'object',
      properties: {
        page_id: {
          type: 'string',
          description: 'The Confluence page ID (from list_family_confluence)'
        }
      },
      required: ['page_id'],
      additionalProperties: false
    },
    strict: true
  }
];

const TOOL_NAMES = TOOL_DEFINITIONS.map(t => t.name);

/**
 * Handle Confluence tool calls
 */
async function handleConfluenceCall(
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
      case 'list_family_confluence': {
        const pages = await getFamilyConfluencePages(supabase, familyPromptIds);
        
        if (pages.length === 0) {
          return JSON.stringify({
            message: 'No Confluence pages attached to this family',
            pages: []
          });
        }
        
        return JSON.stringify({
          message: `${pages.length} Confluence page${pages.length === 1 ? '' : 's'} attached`,
          pages: pages.map(p => ({
            row_id: p.row_id,
            page_id: p.page_id,
            title: p.page_title,
            url: p.page_url,
            space_key: p.space_key,
            space_name: p.space_name,
            sync_status: p.sync_status,
            has_content: !!p.content_text
          }))
        });
      }

      case 'read_confluence_page': {
        const { page_id } = args;
        
        if (!page_id) {
          return JSON.stringify({ error: 'page_id is required' });
        }
        
        const pages = await getFamilyConfluencePages(supabase, familyPromptIds);
        const page = pages.find(p => p.page_id === page_id);
        
        if (!page) {
          return JSON.stringify({ 
            error: 'Page not found in this family',
            available_pages: pages.map(p => ({ page_id: p.page_id, title: p.page_title }))
          });
        }

        if (!page.content_text) {
          return JSON.stringify({
            title: page.page_title,
            url: page.page_url,
            error: 'Content not synced yet. The page exists but its content has not been fetched.',
            sync_status: page.sync_status
          });
        }

        // Truncate very long content
        const maxLength = 50000;
        const truncated = page.content_text.length > maxLength;
        
        return JSON.stringify({
          title: page.page_title,
          url: page.page_url,
          space_key: page.space_key,
          space_name: page.space_name,
          truncated,
          content: truncated 
            ? page.content_text.slice(0, maxLength) + '\n\n[Content truncated at 50KB]' 
            : page.content_text
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Confluence tool error (${toolName}):`, error);
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to execute Confluence tool' 
    });
  }
}

/**
 * Confluence Module
 */
export const confluenceModule: ToolModule = {
  id: 'confluence',
  name: 'Confluence Pages',
  version: '1.0.0',
  scopes: ['family'],
  requires: [],
  
  getTools: (_context: ToolContext): ToolDefinition[] => {
    return TOOL_DEFINITIONS;
  },
  
  handles: (toolName: string): boolean => {
    return TOOL_NAMES.includes(toolName);
  },
  
  handleCall: handleConfluenceCall
};
