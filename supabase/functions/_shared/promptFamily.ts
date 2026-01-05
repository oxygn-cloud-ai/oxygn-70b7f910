// Prompt family utilities for exploring prompt trees

import { TABLES } from "./tables.ts";

/**
 * Resolve root prompt ID by walking up the parent chain
 * Returns the root ID for a given prompt
 */
async function walkToRoot(
  supabase: any,
  promptRowId: string
): Promise<string> {
  let currentId = promptRowId;
  for (let i = 0; i < 15; i++) {
    const { data: prompt } = await supabase
      .from(TABLES.PROMPTS)
      .select('row_id, parent_row_id')
      .eq('row_id', currentId)
      .eq('is_deleted', false)
      .maybeSingle();
    
    if (!prompt?.parent_row_id) break;
    currentId = prompt.parent_row_id;
  }
  return currentId;
}

/**
 * OPTIMIZED: Batch fetch all prompts in a family with minimal queries
 * Returns { promptsMap, rootId } for fast lookup and tree building
 * EXPORTED for reuse to avoid duplicate fetches
 */
export async function batchFetchFamilyPrompts(
  supabase: any,
  startPromptRowId: string,
  knownRootId?: string  // If already resolved, skip the walk
): Promise<{ promptsMap: Map<string, any>; rootId: string }> {
  // Use known root or walk to find it
  const actualRootId = knownRootId ?? await walkToRoot(supabase, startPromptRowId);

  // Now fetch ALL prompts in this family with batched breadth-first traversal
  const allPrompts = new Map<string, any>();
  const toProcess = [actualRootId];
  const processed = new Set<string>();

  while (toProcess.length > 0) {
    const batch = toProcess.splice(0, 50); // Process in batches of 50
    const unprocessed = batch.filter(id => !processed.has(id));
    
    if (unprocessed.length === 0) continue;
    
    // Fetch prompts and their children in parallel
    const [promptsResult, childrenResult] = await Promise.all([
      supabase
        .from(TABLES.PROMPTS)
        .select('row_id, prompt_name, parent_row_id, node_type, model, note, position, output_response, input_admin_prompt, input_user_prompt, post_action, json_schema_template_id, template_row_id')
        .in('row_id', unprocessed)
        .eq('is_deleted', false),
      supabase
        .from(TABLES.PROMPTS)
        .select('row_id, parent_row_id')
        .in('parent_row_id', unprocessed)
        .eq('is_deleted', false)
    ]);

    for (const prompt of promptsResult.data || []) {
      allPrompts.set(prompt.row_id, prompt);
      processed.add(prompt.row_id);
    }

    // Queue children for processing
    for (const child of childrenResult.data || []) {
      if (!processed.has(child.row_id)) {
        toProcess.push(child.row_id);
      }
    }
  }

  return { promptsMap: allPrompts, rootId: actualRootId };
}

/**
 * Build tree structure from pre-fetched prompts map
 */
function buildTreeFromMap(
  promptsMap: Map<string, any>,
  rootId: string,
  depth: number = 0
): any {
  if (depth > 10) return null;
  
  const prompt = promptsMap.get(rootId);
  if (!prompt) return null;

  // Find children from the map
  const children: any[] = [];
  for (const [id, p] of promptsMap) {
    if (p.parent_row_id === rootId) {
      children.push(p);
    }
  }
  
  // Sort by position
  children.sort((a, b) => (a.position || 0) - (b.position || 0));

  const childTrees = children
    .map(child => buildTreeFromMap(promptsMap, child.row_id, depth + 1))
    .filter(Boolean);

  return {
    row_id: prompt.row_id,
    name: prompt.prompt_name,
    node_type: prompt.node_type || 'standard',
    model: prompt.model,
    note: prompt.note,
    has_output: !!prompt.output_response,
    output_preview: prompt.output_response?.slice(0, 200),
    has_system_prompt: !!prompt.input_admin_prompt,
    has_user_prompt: !!prompt.input_user_prompt,
    post_action: prompt.post_action,
    has_json_schema: !!prompt.json_schema_template_id,
    children: childTrees
  };
}

/**
 * Get the complete prompt family tree starting from a root prompt
 * OPTIMIZED: Uses batch fetching instead of N+1 queries
 * Can accept pre-fetched data to avoid duplicate fetches
 */
export async function getPromptFamilyTree(
  supabase: any,
  rootPromptRowId: string,
  prefetchedData?: { promptsMap: Map<string, any>; rootId: string }
): Promise<any> {
  const { promptsMap, rootId } = prefetchedData ?? await batchFetchFamilyPrompts(supabase, rootPromptRowId);
  if (promptsMap.size === 0) return null;
  return buildTreeFromMap(promptsMap, rootId);
}

/**
 * Get all prompt IDs in a family tree
 * OPTIMIZED: Uses batch fetch, can accept pre-fetched data
 */
export async function getFamilyPromptIds(
  supabase: any,
  rootPromptRowId: string,
  prefetchedData?: { promptsMap: Map<string, any>; rootId: string }
): Promise<string[]> {
  const { promptsMap } = prefetchedData ?? await batchFetchFamilyPrompts(supabase, rootPromptRowId);
  return Array.from(promptsMap.keys());
}

function collectIds(node: any, ids: string[]) {
  if (node.row_id) ids.push(node.row_id);
  for (const child of node.children || []) {
    collectIds(child, ids);
  }
}

/**
 * Get all files attached to prompts in a family
 */
export async function getFamilyFiles(
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
 * Get all Confluence pages attached to prompts in a family
 */
export async function getFamilyConfluencePages(
  supabase: any,
  promptIds: string[]
): Promise<any[]> {
  if (promptIds.length === 0) return [];

  const { data: pages } = await supabase
    .from(TABLES.CONFLUENCE_PAGES)
    .select('row_id, prompt_row_id, page_id, page_title, page_url, content_text, sync_status')
    .in('prompt_row_id', promptIds);

  return pages || [];
}

/**
 * Get all JSON schema templates used by prompts in a family
 */
export async function getFamilyJsonSchemas(
  supabase: any,
  promptIds: string[]
): Promise<any[]> {
  if (promptIds.length === 0) return [];

  // Get prompts with json_schema_template_id
  const { data: prompts } = await supabase
    .from(TABLES.PROMPTS)
    .select('row_id, prompt_name, json_schema_template_id')
    .in('row_id', promptIds)
    .not('json_schema_template_id', 'is', null);

  if (!prompts?.length) return [];

  const schemaIds = [...new Set(prompts.map((p: any) => p.json_schema_template_id))];
  
  const { data: schemas } = await supabase
    .from(TABLES.JSON_SCHEMA_TEMPLATES)
    .select('row_id, schema_name, schema_description, json_schema, action_config, child_creation')
    .in('row_id', schemaIds);

  return schemas || [];
}

/**
 * Get all variables for prompts in a family
 */
export async function getFamilyVariables(
  supabase: any,
  promptIds: string[]
): Promise<any[]> {
  if (promptIds.length === 0) return [];

  const { data: variables } = await supabase
    .from(TABLES.PROMPT_VARIABLES)
    .select('row_id, prompt_row_id, variable_name, variable_value, variable_description, is_required')
    .in('prompt_row_id', promptIds);

  return variables || [];
}

/**
 * Get template info from the prompts map (already fetched)
 */
async function getFamilyTemplateFromMap(
  supabase: any,
  promptsMap: Map<string, any>,
  rootId: string
): Promise<any | null> {
  const rootPrompt = promptsMap.get(rootId);
  if (!rootPrompt?.template_row_id) return null;

  const { data: template } = await supabase
    .from(TABLES.TEMPLATES)
    .select('row_id, template_name, template_description, category')
    .eq('row_id', rootPrompt.template_row_id)
    .maybeSingle();

  return template;
}

/**
 * Get prompt family summary for chat context
 * OPTIMIZED: Uses pre-fetched data to avoid duplicate queries
 */
export async function getPromptFamilySummary(
  supabase: any,
  rootPromptRowId: string,
  prefetchedData?: {
    tree?: any;
    promptIds?: string[];
    files?: any[];
    pages?: any[];
    schemas?: any[];
    template?: any | null;
  }
): Promise<string> {
  // Use prefetched data or fetch fresh
  const tree = prefetchedData?.tree ?? await getPromptFamilyTree(supabase, rootPromptRowId);
  if (!tree) return 'Unable to load prompt family.';

  const promptIds = prefetchedData?.promptIds ?? await getFamilyPromptIds(supabase, rootPromptRowId);
  
  // Fetch remaining data in parallel if not prefetched
  const [files, pages, schemas] = await Promise.all([
    prefetchedData?.files ?? getFamilyFiles(supabase, promptIds),
    prefetchedData?.pages ?? getFamilyConfluencePages(supabase, promptIds),
    prefetchedData?.schemas ?? getFamilyJsonSchemas(supabase, promptIds),
  ]);
  
  // Template should be prefetched or null
  const template = prefetchedData?.template ?? null;

  let summary = `## Prompt Family: ${tree.name}\n\n`;
  summary += `- **Total prompts**: ${promptIds.length}\n`;
  summary += `- **Files attached**: ${files.length}\n`;
  summary += `- **Confluence pages**: ${pages.length}\n`;
  summary += `- **JSON schemas**: ${schemas.length}\n`;
  
  if (template) {
    summary += `- **Created from template**: ${template.template_name}\n`;
  }

  summary += '\n### Prompt Structure\n\n';
  summary += formatTreeStructure(tree, 0);

  return summary;
}

/**
 * OPTIMIZED: Get all family data in a single call with parallelization
 * This is the main entry point for the chat panel
 * Returns rootId so callers don't need separate root resolution
 */
export async function getFamilyDataOptimized(
  supabase: any,
  startPromptRowId: string,
  knownRootId?: string  // Pass if already resolved to skip walk
): Promise<{
  familyPromptIds: string[];
  familySummary: string;
  tree: any;
  promptsMap: Map<string, any>;
  rootId: string;
}> {
  const fetchStart = Date.now();
  
  // Step 1: Batch fetch all prompts (includes root resolution if needed)
  const { promptsMap, rootId } = await batchFetchFamilyPrompts(supabase, startPromptRowId, knownRootId);
  const promptIds = Array.from(promptsMap.keys());
  
  console.log(`Batch fetched ${promptIds.length} prompts in ${Date.now() - fetchStart}ms, rootId: ${rootId}`);
  
  // Build tree from cached map (no DB call needed)
  const tree = buildTreeFromMap(promptsMap, rootId);
  
  // Step 2: Parallel fetch additional data (including template)
  const [files, pages, schemas, template] = await Promise.all([
    getFamilyFiles(supabase, promptIds),
    getFamilyConfluencePages(supabase, promptIds),
    getFamilyJsonSchemas(supabase, promptIds),
    getFamilyTemplateFromMap(supabase, promptsMap, rootId)
  ]);
  
  // Step 3: Build summary with prefetched data (no additional DB calls)
  const familySummary = await getPromptFamilySummary(supabase, rootId, {
    tree,
    promptIds,
    files,
    pages,
    schemas,
    template
  });
  
  console.log(`Total family data fetch: ${Date.now() - fetchStart}ms`);
  
  return {
    familyPromptIds: promptIds,
    familySummary,
    tree,
    promptsMap,
    rootId  // Return so callers can use it
  };
}

function formatTreeStructure(node: any, depth: number): string {
  const indent = '  '.repeat(depth);
  const icon = node.node_type === 'action' ? '⚡' : '📝';
  let line = `${indent}${icon} **${node.name}**`;
  
  if (node.has_output) line += ' ✅';
  if (node.has_json_schema) line += ' 📋';
  
  line += '\n';

  for (const child of node.children || []) {
    line += formatTreeStructure(child, depth + 1);
  }

  return line;
}

/**
 * Tool definitions for prompt family exploration
 * Uses Responses API format (flat structure with name at top level)
 */
export function getPromptFamilyTools() {
  return [
    {
      type: "function",
      name: "get_prompt_tree",
      description: "Get the complete prompt family tree showing all prompts and their hierarchy.",
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
      name: "get_prompt_details",
      description: "Get detailed information about a specific prompt including its content, settings, and output.",
      parameters: {
        type: "object",
        properties: {
          prompt_row_id: {
            type: "string",
            description: "The row_id of the prompt to retrieve"
          }
        },
        required: ["prompt_row_id"],
        additionalProperties: false
      },
      strict: true
    },
    {
      type: "function",
      name: "list_family_files",
      description: "List all files attached to prompts in this family.",
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
      name: "read_file_content",
      description: "Read the text content of an attached file. Use list_family_files first to get the file row_id. Only works for text-based files (txt, md, csv, json, xml, html, yml, yaml, log).",
      parameters: {
        type: "object",
        properties: {
          file_row_id: {
            type: "string",
            description: "The row_id of the file to read"
          }
        },
        required: ["file_row_id"],
        additionalProperties: false
      },
      strict: true
    },
    {
      type: "function",
      name: "list_family_confluence",
      description: "List all Confluence pages attached to prompts in this family.",
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
      name: "read_confluence_page",
      description: "Read the full content of an attached Confluence page.",
      parameters: {
        type: "object",
        properties: {
          page_id: {
            type: "string",
            description: "The Confluence page ID"
          }
        },
        required: ["page_id"],
        additionalProperties: false
      },
      strict: true
    },
    {
      type: "function",
      name: "list_family_variables",
      description: "List all variables defined across prompts in this family.",
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
      name: "list_json_schemas",
      description: "List all JSON schema templates used by prompts in this family.",
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
      name: "get_json_schema_details",
      description: "Get the full details of a JSON schema template including its structure and configuration.",
      parameters: {
        type: "object",
        properties: {
          schema_row_id: {
            type: "string",
            description: "The row_id of the JSON schema template"
          }
        },
        required: ["schema_row_id"],
        additionalProperties: false
      },
      strict: true
    }
  ];
}
