// Shared tool definitions for OpenAI APIs
// Supports both Assistants API (legacy) and Responses API (new) formats

/**
 * Confluence tools in Assistants API format (legacy)
 * Format: { type: "function", function: { name, description, parameters } }
 */
export function getConfluenceToolsAssistants() {
  return [
    {
      type: "function",
      function: {
        name: "confluence_search",
        description: "Search Confluence documentation for relevant pages. Use this when you need to find information in the team's knowledge base.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to find relevant pages"
            },
            space_key: {
              type: "string",
              description: "Optional: Limit search to a specific Confluence space"
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "confluence_read",
        description: "Read the full content of a specific Confluence page. Use this after searching to get detailed information.",
        parameters: {
          type: "object",
          properties: {
            page_id: {
              type: "string",
              description: "The Confluence page ID to read"
            }
          },
          required: ["page_id"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "confluence_list_children",
        description: "List child pages under a specific Confluence page. Use this to explore page hierarchy.",
        parameters: {
          type: "object",
          properties: {
            page_id: {
              type: "string",
              description: "The parent Confluence page ID"
            }
          },
          required: ["page_id"]
        }
      }
    }
  ];
}

/**
 * Confluence tools in Responses API format (new)
 * Format: { type: "function", name, description, parameters, strict }
 */
export function getConfluenceToolsResponses() {
  return [
    {
      type: "function",
      name: "confluence_search",
      description: "Search Confluence documentation for relevant pages. Use this when you need to find information in the team's knowledge base.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant pages"
          },
          space_key: {
            type: ["string", "null"],
            description: "Optional: Limit search to a specific Confluence space"
          }
        },
        required: ["query", "space_key"],
        additionalProperties: false
      },
      strict: true
    },
    {
      type: "function",
      name: "confluence_read",
      description: "Read the full content of a specific Confluence page. Use this after searching to get detailed information.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The Confluence page ID to read"
          }
        },
        required: ["page_id"],
        additionalProperties: false
      },
      strict: true
    },
    {
      type: "function",
      name: "confluence_list_children",
      description: "List child pages under a specific Confluence page. Use this to explore page hierarchy.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The parent Confluence page ID"
          }
        },
        required: ["page_id"],
        additionalProperties: false
      },
      strict: true
    }
  ];
}

/**
 * Built-in tools for Assistants API (legacy)
 */
export function getBuiltinToolsAssistants(config: {
  codeInterpreterEnabled?: boolean;
  fileSearchEnabled?: boolean;
}) {
  const tools: any[] = [];
  if (config.codeInterpreterEnabled) {
    tools.push({ type: 'code_interpreter' });
  }
  if (config.fileSearchEnabled) {
    tools.push({ type: 'file_search' });
  }
  return tools;
}

/**
 * Built-in tools for Responses API (new)
 * Note: file_search requires vector_store_ids, code_interpreter requires container
 */
export function getBuiltinToolsResponses(config: {
  codeInterpreterEnabled?: boolean;
  fileSearchEnabled?: boolean;
  vectorStoreIds?: string[];
  containerFileIds?: string[];
}) {
  const tools: any[] = [];
  
  if (config.codeInterpreterEnabled) {
    tools.push({ 
      type: 'code_interpreter',
      container: {
        type: 'auto',
        ...(config.containerFileIds?.length && { file_ids: config.containerFileIds })
      }
    });
  }
  
  if (config.fileSearchEnabled && config.vectorStoreIds?.length) {
    tools.push({ 
      type: 'file_search',
      vector_store_ids: config.vectorStoreIds,
      max_num_results: 10
    });
  }
  
  return tools;
}

/**
 * Get all tools based on API version
 */
export function getAllTools(
  apiVersion: 'assistants' | 'responses',
  config: {
    codeInterpreterEnabled?: boolean;
    fileSearchEnabled?: boolean;
    confluenceEnabled?: boolean;
    vectorStoreIds?: string[];
    containerFileIds?: string[];
  }
) {
  if (apiVersion === 'responses') {
    const builtinTools = getBuiltinToolsResponses({
      codeInterpreterEnabled: config.codeInterpreterEnabled,
      fileSearchEnabled: config.fileSearchEnabled,
      vectorStoreIds: config.vectorStoreIds,
      containerFileIds: config.containerFileIds,
    });
    const confluenceTools = config.confluenceEnabled ? getConfluenceToolsResponses() : [];
    return [...builtinTools, ...confluenceTools];
  } else {
    const builtinTools = getBuiltinToolsAssistants({
      codeInterpreterEnabled: config.codeInterpreterEnabled,
      fileSearchEnabled: config.fileSearchEnabled,
    });
    const confluenceTools = config.confluenceEnabled ? getConfluenceToolsAssistants() : [];
    return [...builtinTools, ...confluenceTools];
  }
}

/**
 * Check if response output contains function calls (Responses API)
 */
export function hasFunctionCalls(output: any[]): boolean {
  return output?.some(item => item.type === 'function_call') ?? false;
}

/**
 * Extract text from Responses API output
 */
export function extractTextFromResponseOutput(output: any[]): string {
  if (!output || !Array.isArray(output)) return '';
  
  return output
    .filter(item => item.type === 'message')
    .flatMap(msg => msg.content || [])
    .filter(c => c.type === 'output_text')
    .map(c => c.text)
    .join('');
}
