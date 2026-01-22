/**
 * Create Template Action Executor
 * 
 * Saves the current node structure as a reusable template.
 */
import { 
  TypedSupabaseClient, 
  ExecutorParams, 
  ExecutorResult
} from './types';

// Table references from environment
const PROMPTS_TABLE = import.meta.env.VITE_PROMPTS_TBL;
const TEMPLATES_TABLE = import.meta.env.VITE_TEMPLATES_TBL;

interface TemplateStructure {
  name: string;
  input_admin_prompt: string;
  input_user_prompt: string;
  model: string | null;
  temperature: string | null;
  temperature_on: boolean | null;
  max_tokens: string | null;
  max_tokens_on: boolean | null;
  max_completion_tokens: string | null;
  max_completion_tokens_on: boolean | null;
  node_type: string;
  post_action: string | null;
  post_action_config: Record<string, unknown> | null;
  children: TemplateStructure[];
}

interface VariableDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
}

/**
 * Build template structure from a prompt and optionally its children
 */
const buildTemplateStructure = async (
  supabase: TypedSupabaseClient, 
  promptRowId: string, 
  includeChildren = true
): Promise<TemplateStructure> => {
  const { data: prompt, error: promptError } = await supabase
    .from(PROMPTS_TABLE)
    .select('*')
    .eq('row_id', promptRowId)
    .maybeSingle();

  if (promptError || !prompt) throw promptError || new Error('Prompt not found');

  // CRITICAL: Sanitize q.ref[UUID] patterns to prevent cross-family data leakage
  const sanitizeQRef = (text: string | null): string => {
    if (!text || typeof text !== 'string') return text || '';
    return text.replace(/\{\{q\.ref\[[a-f0-9-]{36}\]\.([a-z_]+)\}\}/gi, '{{q.ref[TEMPLATE_REF].$1}}');
  };

  const structure: TemplateStructure = {
    name: prompt.prompt_name || 'Untitled',
    input_admin_prompt: sanitizeQRef(prompt.input_admin_prompt),
    input_user_prompt: sanitizeQRef(prompt.input_user_prompt),
    model: prompt.model,
    temperature: prompt.temperature,
    temperature_on: prompt.temperature_on,
    max_tokens: prompt.max_tokens,
    max_tokens_on: prompt.max_tokens_on,
    max_completion_tokens: prompt.max_completion_tokens,
    max_completion_tokens_on: prompt.max_completion_tokens_on,
    node_type: prompt.node_type || 'standard',
    post_action: prompt.post_action,
    post_action_config: prompt.post_action_config as Record<string, unknown> | null,
    children: [],
  };

  if (includeChildren) {
    const { data: children, error: childError } = await supabase
      .from(PROMPTS_TABLE)
      .select('row_id')
      .eq('parent_row_id', promptRowId)
      .eq('is_deleted', false)
      .order('position', { ascending: true });

    if (childError) throw childError;

    if (children?.length > 0) {
      for (const child of children) {
        const childStructure = await buildTemplateStructure(supabase, child.row_id, true);
        structure.children.push(childStructure);
      }
    }
  }

  return structure;
};

/**
 * Extract variable definitions from template structure
 */
const extractVariableDefinitions = (
  structure: TemplateStructure, 
  definitions: Record<string, VariableDefinition> = {}
): Record<string, VariableDefinition> => {
  const variablePattern = /\{\{([^}]+)\}\}/g;
  
  let match: RegExpExecArray | null;
  while ((match = variablePattern.exec(structure.input_admin_prompt || '')) !== null) {
    const varName = match[1].trim();
    if (!varName.startsWith('q.') && !definitions[varName]) {
      definitions[varName] = {
        name: varName,
        type: 'text',
        required: false,
        defaultValue: '',
      };
    }
  }

  variablePattern.lastIndex = 0;
  while ((match = variablePattern.exec(structure.input_user_prompt || '')) !== null) {
    const varName = match[1].trim();
    if (!varName.startsWith('q.') && !definitions[varName]) {
      definitions[varName] = {
        name: varName,
        type: 'text',
        required: false,
        defaultValue: '',
      };
    }
  }

  if (structure.children?.length > 0) {
    for (const child of structure.children) {
      extractVariableDefinitions(child, definitions);
    }
  }

  return definitions;
};

/**
 * Execute the create template action
 */
export const executeCreateTemplate = async ({
  supabase,
  prompt,
  config,
  context,
}: ExecutorParams): Promise<ExecutorResult> => {
  const {
    template_name,
    template_description = '',
    include_children = true,
  } = config || {};

  if (!template_name) {
    throw new Error('Template name is required');
  }

  const structure = await buildTemplateStructure(supabase, prompt.row_id, include_children as boolean);
  const variableDefinitions = extractVariableDefinitions(structure);

  const templateData = {
    template_name: template_name as string,
    template_description: template_description as string,
    structure,
    variable_definitions: variableDefinitions,
    owner_id: (context?.userId as string) || prompt.owner_id,
    category: 'action-generated',
    is_private: false,
    version: 1,
  };

  const { data, error } = await supabase
    .from(TEMPLATES_TABLE)
    .insert(templateData)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating template:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('Failed to create template - no data returned');
  }

  return {
    success: true,
    action: 'create_template',
    template: data,
    message: `Created template "${template_name}"`,
  };
};
