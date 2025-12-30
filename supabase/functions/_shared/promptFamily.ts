// Prompt family utilities for exploring prompt trees

import { TABLES } from "./tables.ts";

/**
 * Get the complete prompt family tree starting from a root prompt
 */
export async function getPromptFamilyTree(
  supabase: any,
  rootPromptRowId: string
): Promise<any> {
  // First get the root prompt
  const { data: rootPrompt, error: rootError } = await supabase
    .from(TABLES.PROMPTS)
    .select('row_id, prompt_name, parent_row_id, node_type, model, note, output_response, input_admin_prompt, input_user_prompt')
    .eq('row_id', rootPromptRowId)
    .eq('is_deleted', false)
    .single();

  if (rootError || !rootPrompt) {
    return null;
  }

  // Find the actual root (top-level ancestor)
  let actualRoot = rootPrompt;
  while (actualRoot.parent_row_id) {
    const { data: parent } = await supabase
      .from(TABLES.PROMPTS)
      .select('row_id, prompt_name, parent_row_id, node_type, model, note, output_response')
      .eq('row_id', actualRoot.parent_row_id)
      .eq('is_deleted', false)
      .single();
    
    if (!parent) break;
    actualRoot = parent;
  }

  // Build complete tree from actual root
  const tree = await buildPromptTree(supabase, actualRoot.row_id);
  return tree;
}

async function buildPromptTree(supabase: any, promptRowId: string, depth: number = 0): Promise<any> {
  if (depth > 10) return null; // Prevent infinite recursion

  const { data: prompt } = await supabase
    .from(TABLES.PROMPTS)
    .select('row_id, prompt_name, parent_row_id, node_type, model, note, position, output_response, input_admin_prompt, input_user_prompt, post_action, json_schema_template_id')
    .eq('row_id', promptRowId)
    .eq('is_deleted', false)
    .single();

  if (!prompt) return null;

  // Get children
  const { data: children } = await supabase
    .from(TABLES.PROMPTS)
    .select('row_id')
    .eq('parent_row_id', promptRowId)
    .eq('is_deleted', false)
    .order('position', { ascending: true });

  const childTrees = [];
  for (const child of children || []) {
    const childTree = await buildPromptTree(supabase, child.row_id, depth + 1);
    if (childTree) childTrees.push(childTree);
  }

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
 * Get all prompt IDs in a family tree
 */
export async function getFamilyPromptIds(
  supabase: any,
  rootPromptRowId: string
): Promise<string[]> {
  const tree = await getPromptFamilyTree(supabase, rootPromptRowId);
  if (!tree) return [];
  
  const ids: string[] = [];
  collectIds(tree, ids);
  return ids;
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
    .select('row_id, assistant_row_id, original_filename, mime_type, file_size, upload_status')
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
 * Get template info if the family was created from a template
 */
export async function getFamilyTemplate(
  supabase: any,
  rootPromptRowId: string
): Promise<any | null> {
  const { data: prompt } = await supabase
    .from(TABLES.PROMPTS)
    .select('template_row_id')
    .eq('row_id', rootPromptRowId)
    .single();

  if (!prompt?.template_row_id) return null;

  const { data: template } = await supabase
    .from(TABLES.TEMPLATES)
    .select('row_id, template_name, template_description, category')
    .eq('row_id', prompt.template_row_id)
    .single();

  return template;
}

/**
 * Get prompt family summary for chat context
 */
export async function getPromptFamilySummary(
  supabase: any,
  rootPromptRowId: string
): Promise<string> {
  const tree = await getPromptFamilyTree(supabase, rootPromptRowId);
  if (!tree) return 'Unable to load prompt family.';

  const promptIds = await getFamilyPromptIds(supabase, rootPromptRowId);
  const files = await getFamilyFiles(supabase, promptIds);
  const pages = await getFamilyConfluencePages(supabase, promptIds);
  const schemas = await getFamilyJsonSchemas(supabase, promptIds);
  const template = await getFamilyTemplate(supabase, rootPromptRowId);

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
 */
export function getPromptFamilyTools() {
  return [
    {
      type: "function",
      function: {
        name: "get_prompt_tree",
        description: "Get the complete prompt family tree showing all prompts and their hierarchy.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
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
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_family_files",
        description: "List all files attached to prompts in this family.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_family_confluence",
        description: "List all Confluence pages attached to prompts in this family.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
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
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_family_variables",
        description: "List all variables defined across prompts in this family.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_json_schemas",
        description: "List all JSON schema templates used by prompts in this family.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
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
        }
      }
    }
  ];
}
