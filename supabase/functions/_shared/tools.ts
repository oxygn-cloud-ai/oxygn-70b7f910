// Shared tool definitions for OpenAI Responses API

/**
 * Confluence tools in Responses API format
 * These tools only access pages that have been explicitly attached to the conversation.
 * Format: { type: "function", name, description, parameters, strict }
 */
export function getConfluenceTools(attachedPageIds?: string[]) {
  // If no pages are attached, provide a tool that explains the limitation
  if (!attachedPageIds || attachedPageIds.length === 0) {
    return [
      {
        type: "function",
        name: "confluence_list_attached",
        description: "List all Confluence pages that have been attached to this conversation. No pages are currently attached.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        },
        strict: true
      }
    ];
  }

  return [
    {
      type: "function",
      name: "confluence_list_attached",
      description: "List all Confluence pages that have been attached to this conversation. Use this first to see what documentation is available.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
      },
      strict: true
    },
    {
      type: "function",
      name: "confluence_read_attached",
      description: "Read the full content of an attached Confluence page. You can only read pages that have been attached to this conversation.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The Confluence page ID from the attached pages list"
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
  attachedConfluencePageIds?: string[];
}) {
  const builtinTools = getBuiltinTools({
    codeInterpreterEnabled: config.codeInterpreterEnabled,
    fileSearchEnabled: config.fileSearchEnabled,
    webSearchEnabled: config.webSearchEnabled,
    vectorStoreIds: config.vectorStoreIds,
    containerFileIds: config.containerFileIds,
  });
  const confluenceTools = config.confluenceEnabled 
    ? getConfluenceTools(config.attachedConfluencePageIds) 
    : [];
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