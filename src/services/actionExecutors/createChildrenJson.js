/**
 * Create Children (JSON) Action Executor
 * 
 * Creates child nodes from a JSON array in the AI response.
 * Each item in the array becomes a child node.
 */

const PROMPTS_TABLE = 'q_prompts';
const SETTINGS_TABLE = 'q_settings';
const MODEL_DEFAULTS_TABLE = 'q_model_defaults';

/**
 * Get nested value from object using dot notation path
 * e.g., getNestedValue({ data: { items: [1,2,3] } }, 'data.items') => [1,2,3]
 */
const getNestedValue = (obj, path) => {
  if (!path) return obj;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    
    // Handle array index access
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[parseInt(key, 10)];
    } else {
      value = value[key];
    }
  }
  
  return value;
};

/**
 * Get default prompt settings from the database
 */
const getDefaultSettings = async (supabase) => {
  const { data } = await supabase
    .from(SETTINGS_TABLE)
    .select('setting_key, setting_value')
    .in('setting_key', ['def_admin_prompt', 'default_user_prompt', 'default_model']);

  const settings = {};
  data?.forEach(row => {
    settings[row.setting_key] = row.setting_value;
  });
  return settings;
};

/**
 * Get model defaults for a specific model
 */
const getModelDefaults = async (supabase, modelId) => {
  if (!modelId) return {};

  const { data } = await supabase
    .from(MODEL_DEFAULTS_TABLE)
    .select('*')
    .eq('model_id', modelId)
    .maybeSingle();

  if (!data) return { model: modelId, model_on: true };

  const defaults = { model: modelId, model_on: true };
  const fields = ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
    'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'];

  fields.forEach(field => {
    if (data[`${field}_on`]) {
      defaults[field] = data[field];
      defaults[`${field}_on`] = true;
    }
  });

  return defaults;
};

/**
 * Get inheritable settings from parent prompt
 */
const getParentSettings = async (supabase, parentRowId) => {
  if (!parentRowId) return {};

  const { data } = await supabase
    .from(PROMPTS_TABLE)
    .select('model, model_on, web_search_on, confluence_enabled, thread_mode, child_thread_strategy')
    .eq('row_id', parentRowId)
    .single();

  return data || {};
};

/**
 * Get library prompt content if specified
 */
const getLibraryPrompt = async (supabase, libraryPromptId) => {
  if (!libraryPromptId) return null;

  const { data } = await supabase
    .from('q_prompt_library')
    .select('content, name')
    .eq('row_id', libraryPromptId)
    .single();

  return data;
};

/**
 * Execute the create children JSON action
 */
export const executeCreateChildrenJson = async ({
  supabase,
  prompt,
  jsonResponse,
  config,
  context,
}) => {
  const {
    json_path = 'items',
    name_field = 'name',
    content_field = '',
    copy_library_prompt_id,
  } = config || {};

  // Extract array from JSON response
  const items = getNestedValue(jsonResponse, json_path);
  
  if (!Array.isArray(items)) {
    throw new Error(`JSON path "${json_path}" does not point to an array. Found: ${typeof items}`);
  }

  if (items.length === 0) {
    return {
      action: 'create_children_json',
      createdCount: 0,
      children: [],
      message: 'No items found in JSON array',
    };
  }

  // Get default settings
  const defaults = await getDefaultSettings(supabase);
  
  // Get model defaults if a default model is set
  const modelDefaults = await getModelDefaults(supabase, defaults.default_model);
  
  // Get parent settings to inherit
  const parentSettings = await getParentSettings(supabase, prompt.row_id);

  // Get library prompt if specified
  const libraryPrompt = await getLibraryPrompt(supabase, copy_library_prompt_id);

  // Get current max position among siblings
  const { data: siblings } = await supabase
    .from(PROMPTS_TABLE)
    .select('position')
    .eq('parent_row_id', prompt.row_id)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (siblings?.[0]?.position ?? -1) + 1;

  const createdChildren = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Determine child name
    let childName;
    if (typeof item === 'string') {
      childName = item.substring(0, 50) || `Item ${i + 1}`;
    } else if (typeof item === 'object' && item !== null) {
      childName = getNestedValue(item, name_field) || 
                  item.title || 
                  item.label || 
                  `Item ${i + 1}`;
    } else {
      childName = `Item ${i + 1}`;
    }

    // Determine content
    let content;
    if (typeof item === 'string') {
      content = item;
    } else if (content_field) {
      content = getNestedValue(item, content_field);
      if (typeof content !== 'string') {
        content = JSON.stringify(content, null, 2);
      }
    } else {
      content = JSON.stringify(item, null, 2);
    }

    // Build child data with proper inheritance
    const childData = {
      parent_row_id: prompt.row_id,
      prompt_name: String(childName).substring(0, 100),
      input_admin_prompt: libraryPrompt?.content || defaults.def_admin_prompt || '',
      input_user_prompt: content || '',
      position: nextPosition++,
      owner_id: context.userId || prompt.owner_id,
      node_type: 'standard',
      // Store the original item data for reference
      extracted_variables: typeof item === 'object' ? item : { value: item },
      // Apply model defaults
      ...modelDefaults,
      // Inherit settings from parent
      web_search_on: parentSettings.web_search_on,
      confluence_enabled: parentSettings.confluence_enabled,
      thread_mode: parentSettings.thread_mode,
      child_thread_strategy: parentSettings.child_thread_strategy,
    };

    if (copy_library_prompt_id) {
      childData.library_prompt_id = copy_library_prompt_id;
    }

    const { data, error } = await supabase
      .from(PROMPTS_TABLE)
      .insert(childData)
      .select()
      .single();

    if (error) {
      console.error('Error creating child node from JSON:', error);
      throw error;
    }

    createdChildren.push(data);
  }

  return {
    action: 'create_children_json',
    createdCount: createdChildren.length,
    children: createdChildren,
    jsonPath: json_path,
    message: `Created ${createdChildren.length} child node(s) from JSON array`,
  };
};
