/**
 * GitHub Tool Module
 * Provides read-only access to the application source code repository
 */

import type { ToolModule, ToolContext, ToolDefinition } from './types.ts';
import { handleGithubToolCall } from '../github.ts';

const GITHUB_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'github_list_files',
    description: 'List files and directories at a path in the application source code.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: ['string', 'null'],
          description: "Directory path to list (e.g., 'src/components', 'supabase/functions'). Null or empty string for root."
        }
      },
      required: ['path'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'github_read_file',
    description: 'Read the content of a source code file. Large files are automatically truncated.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: "Full path to the file (e.g., 'src/App.jsx', 'supabase/functions/workbench-chat/index.ts')"
        }
      },
      required: ['file_path'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'github_search_code',
    description: 'Search for code patterns, function names, or text in the application source code.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - function names, variable names, text patterns, etc.'
        },
        file_extension: {
          type: ['string', 'null'],
          description: "File extension filter (e.g., 'ts', 'jsx', 'sql'). Null to search all files."
        }
      },
      required: ['query', 'file_extension'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'github_get_structure',
    description: 'Get the full directory structure of the application source code or a subdirectory. Useful for understanding codebase organization.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: ['string', 'null'],
          description: "Path to filter (e.g., 'src', 'supabase'). Null for full repo structure."
        }
      },
      required: ['path'],
      additionalProperties: false
    },
    strict: true
  }
];

const TOOL_NAMES = GITHUB_TOOLS.map(t => t.name);

export const githubModule: ToolModule = {
  id: 'github',
  name: 'GitHub Source Code',
  version: '1.0.0',
  scopes: ['family'],
  
  requires: [
    { key: 'githubToken', required: true }
  ],
  
  getTools(_context: ToolContext): ToolDefinition[] {
    return GITHUB_TOOLS;
  },
  
  handles(toolName: string): boolean {
    return TOOL_NAMES.includes(toolName);
  },
  
  async handleCall(toolName: string, args: any, context: ToolContext): Promise<string> {
    const token = (context.credentials as any)?.githubToken;
    const owner = Deno.env.get('GITHUB_OWNER');
    const repo = Deno.env.get('GITHUB_REPO');
    
    if (!token) {
      return JSON.stringify({ error: 'GitHub token not configured' });
    }
    
    if (!owner || !repo) {
      return JSON.stringify({ error: 'GitHub repository not configured (GITHUB_OWNER/GITHUB_REPO)' });
    }
    
    return handleGithubToolCall(toolName, args, token, owner, repo);
  }
};
