// Shared tool definitions for OpenAI Responses API

/**
 * Confluence tools in Responses API format
 * Format: { type: "function", name, description, parameters, strict }
 */
export function getConfluenceTools() {
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
 * Built-in tools for Responses API
 * Note: file_search requires vector_store_ids, code_interpreter requires container
 * web_search is a native Responses API capability
 */
export function getBuiltinTools(config: {
  codeInterpreterEnabled?: boolean;
  fileSearchEnabled?: boolean;
  webSearchEnabled?: boolean;
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

  // Web search is a native Responses API tool
  if (config.webSearchEnabled) {
    tools.push({
      type: 'web_search_preview'
    });
  }
  
  return tools;
}

/**
 * Get all tools for Responses API
 */
export function getAllTools(config: {
  codeInterpreterEnabled?: boolean;
  fileSearchEnabled?: boolean;
  webSearchEnabled?: boolean;
  confluenceEnabled?: boolean;
  vectorStoreIds?: string[];
  containerFileIds?: string[];
}) {
  const builtinTools = getBuiltinTools({
    codeInterpreterEnabled: config.codeInterpreterEnabled,
    fileSearchEnabled: config.fileSearchEnabled,
    webSearchEnabled: config.webSearchEnabled,
    vectorStoreIds: config.vectorStoreIds,
    containerFileIds: config.containerFileIds,
  });
  const confluenceTools = config.confluenceEnabled ? getConfluenceTools() : [];
  return [...builtinTools, ...confluenceTools];
}

/**
 * Check if response output contains function calls
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
