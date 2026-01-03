/**
 * Files Tools Module
 * Provides tools for listing and reading files attached to the prompt family
 */

import type { ToolModule, ToolContext, ToolDefinition } from './types.ts';
import { TABLES } from '../tables.ts';

/**
 * Get files attached to prompts in a family (via assistants)
 */
async function getFamilyFiles(
  supabase: any,
  promptIds: string[]
): Promise<any[]> {
  if (promptIds.length === 0) return [];

  // Files are attached via assistants, which link to prompts
  const { data: assistants } = await supabase
    .from(TABLES.ASSISTANTS)
    .select('row_id, prompt_row_id')
    .in('prompt_row_id', promptIds);

  if (!assistants?.length) return [];

  const assistantIds = assistants.map((a: any) => a.row_id);
  
  const { data: files } = await supabase
    .from(TABLES.ASSISTANT_FILES)
    .select('row_id, assistant_row_id, original_filename, mime_type, file_size, upload_status, storage_path')
    .in('assistant_row_id', assistantIds);

  // Map files to their prompts
  const assistantToPrompt = Object.fromEntries(
    assistants.map((a: any) => [a.row_id, a.prompt_row_id])
  );

  return (files || []).map((f: any) => ({
    ...f,
    prompt_row_id: assistantToPrompt[f.assistant_row_id]
  }));
}

/**
 * Files tools for exploring attached documents
 */
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'list_family_files',
    description: 'List all files attached to prompts in this family. Shows filenames, types, sizes, and upload status.',
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
    description: 'Read the text content of a file attached to this family. Only works for text-based files (txt, md, csv, json, xml, html, yml, yaml, log).',
    parameters: {
      type: 'object',
      properties: {
        file_row_id: {
          type: 'string',
          description: 'The file row_id (from list_family_files)'
        }
      },
      required: ['file_row_id'],
      additionalProperties: false
    },
    strict: true
  }
];

const TOOL_NAMES = TOOL_DEFINITIONS.map(t => t.name);

// Text-based MIME types we can read
const TEXT_MIME_TYPES = [
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml', 'text/x-markdown'
];

// File extensions we can read
const TEXT_EXTENSIONS = /\.(txt|md|csv|json|xml|html|yml|yaml|log)$/i;

/**
 * Handle file tool calls
 */
async function handleFilesCall(
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
      case 'list_family_files': {
        const files = await getFamilyFiles(supabase, familyPromptIds);
        
        if (files.length === 0) {
          return JSON.stringify({
            message: 'No files attached to this family',
            files: []
          });
        }
        
        return JSON.stringify({
          message: `${files.length} file${files.length === 1 ? '' : 's'} attached to this family`,
          files: files.map(f => ({
            row_id: f.row_id,
            filename: f.original_filename,
            mime_type: f.mime_type,
            size: f.file_size,
            size_formatted: formatFileSize(f.file_size),
            status: f.upload_status,
            prompt_row_id: f.prompt_row_id,
            is_text_file: isTextFile(f)
          }))
        });
      }

      case 'read_file_content': {
        const { file_row_id } = args;
        
        if (!file_row_id) {
          return JSON.stringify({ error: 'file_row_id is required' });
        }
        
        const files = await getFamilyFiles(supabase, familyPromptIds);
        const file = files.find((f: any) => f.row_id === file_row_id);
        
        if (!file) {
          return JSON.stringify({ 
            error: 'File not found in this family',
            available_files: files.map(f => ({ row_id: f.row_id, filename: f.original_filename }))
          });
        }
        
        // Check if it's a text file
        if (!isTextFile(file)) {
          return JSON.stringify({ 
            error: 'Cannot read binary file content. Only text-based files are supported.',
            filename: file.original_filename,
            mime_type: file.mime_type,
            supported_types: 'txt, md, csv, json, xml, html, yml, yaml, log'
          });
        }
        
        if (!file.storage_path) {
          return JSON.stringify({ error: 'File has no storage path' });
        }
        
        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('assistant-files')
          .download(file.storage_path);
        
        if (downloadError || !fileData) {
          console.error('File download error:', downloadError);
          return JSON.stringify({ error: 'Failed to download file from storage' });
        }
        
        const content = await fileData.text();
        const maxLength = 50000;
        const truncated = content.length > maxLength;
        
        return JSON.stringify({
          filename: file.original_filename,
          mime_type: file.mime_type,
          size: file.file_size,
          truncated,
          content: truncated 
            ? content.slice(0, maxLength) + '\n\n[Content truncated at 50KB]' 
            : content
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Files tool error (${toolName}):`, error);
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to execute files tool' 
    });
  }
}

/**
 * Check if a file is text-based
 */
function isTextFile(file: any): boolean {
  return TEXT_MIME_TYPES.some(t => file.mime_type?.startsWith(t)) ||
    TEXT_EXTENSIONS.test(file.original_filename || '');
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Files Module
 */
export const filesModule: ToolModule = {
  id: 'files',
  name: 'Family Files',
  version: '1.0.0',
  scopes: ['family'],
  requires: [],
  
  getTools: (_context: ToolContext): ToolDefinition[] => {
    return TOOL_DEFINITIONS;
  },
  
  handles: (toolName: string): boolean => {
    return TOOL_NAMES.includes(toolName);
  },
  
  handleCall: handleFilesCall
};
