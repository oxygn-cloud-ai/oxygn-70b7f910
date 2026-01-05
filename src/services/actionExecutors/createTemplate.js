/**
 * Create Template Action Executor
 * 
 * Saves the current node structure as a reusable template.
 */

const PROMPTS_TABLE = 'q_prompts';
const TEMPLATES_TABLE = 'q_templates';

/**
 * Build template structure from a prompt and optionally its children
 */
const buildTemplateStructure = async (supabase, promptRowId, includeChildren = true) => {
  // Fetch the main prompt
  const { data: prompt, error: promptError } = await supabase
    .from(PROMPTS_TABLE)
    .select('*')
    .eq('row_id', promptRowId)
    .maybeSingle();

  if (promptError || !prompt) throw promptError || new Error('Prompt not found');

  // Build base structure
  const structure = {
    name: prompt.prompt_name || 'Untitled',
    input_admin_prompt: prompt.input_admin_prompt || '',
    input_user_prompt: prompt.input_user_prompt || '',
    model: prompt.model,
    temperature: prompt.temperature,
    max_tokens: prompt.max_tokens,
    node_type: prompt.node_type || 'standard',
    post_action: prompt.post_action,
    post_action_config: prompt.post_action_config,
    children: [],
  };

  // Fetch children if requested
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
const extractVariableDefinitions = (structure, definitions = {}) => {
  const variablePattern = /\{\{([^}]+)\}\}/g;
  
  // Check admin prompt
  let match;
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

  // Check user prompt
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

  // Process children
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
  jsonResponse,
  config,
  context,
}) => {
  const {
    template_name,
    template_description = '',
    include_children = true,
  } = config || {};

  if (!template_name) {
    throw new Error('Template name is required');
  }

  // Build structure from current node
  const structure = await buildTemplateStructure(supabase, prompt.row_id, include_children);
  
  // Extract variable definitions
  const variableDefinitions = extractVariableDefinitions(structure);

  // Create the template
  const templateData = {
    template_name,
    template_description,
    structure,
    variable_definitions: variableDefinitions,
    owner_id: context.userId || prompt.owner_id,
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
    action: 'create_template',
    template: data,
    message: `Created template "${template_name}"`,
  };
};
