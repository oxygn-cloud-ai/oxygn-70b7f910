/**
 * Create Children (Sections) Action Executor
 * 
 * Creates child nodes from JSON keys matching a "section nn" pattern.
 * Each matching key becomes a child node with the value as the name.
 * Optionally looks for corresponding content keys (e.g., "section 01 system prompt").
 */

const PROMPTS_TABLE = 'q_prompts';
const SETTINGS_TABLE = 'q_settings';
const MODEL_DEFAULTS_TABLE = 'q_model_defaults';

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
 * Get inheritable settings from a prompt (parent or action prompt itself)
 */
const getPromptSettings = async (supabase, promptRowId) => {
  if (!promptRowId) return {};

  const { data } = await supabase
    .from(PROMPTS_TABLE)
    .select(`
      model, model_on, web_search_on, confluence_enabled, thread_mode, 
      child_thread_strategy, temperature, temperature_on, max_tokens, max_tokens_on,
      top_p, top_p_on, frequency_penalty, frequency_penalty_on, presence_penalty, 
      presence_penalty_on, input_admin_prompt
    `)
    .eq('row_id', promptRowId)
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
 * Get the next position for new prompts based on placement
 */
const getNextPosition = async (supabase, parentRowId) => {
  const { data: siblings } = await supabase
    .from(PROMPTS_TABLE)
    .select('position')
    .eq(parentRowId ? 'parent_row_id' : 'parent_row_id', parentRowId)
    .order('position', { ascending: false })
    .limit(1);

  return (siblings?.[0]?.position ?? -1) + 1;
};

/**
 * Execute the create children sections action
 */
export const executeCreateChildrenSections = async ({
  supabase,
  prompt,
  jsonResponse,
  config,
  context,
}) => {
  const {
    section_pattern = '^section\\s*\\d+',
    name_source = 'key_value',
    content_key_suffix = 'system prompt',
    placement = 'children',
    copy_library_prompt_id,
  } = config || {};

  // Create regex from pattern
  let sectionRegex;
  try {
    sectionRegex = new RegExp(section_pattern, 'i');
  } catch (e) {
    throw new Error(`Invalid regex pattern: ${section_pattern}`);
  }

  // Find all keys matching the section pattern (excluding content keys)
  const contentSuffixLower = content_key_suffix?.toLowerCase()?.trim() || '';
  const sectionKeys = Object.keys(jsonResponse).filter(key => {
    const keyLower = key.toLowerCase();
    // Match section pattern but exclude content keys
    if (contentSuffixLower && keyLower.endsWith(contentSuffixLower)) {
      return false;
    }
    return sectionRegex.test(key);
  });

  if (sectionKeys.length === 0) {
    return {
      action: 'create_children_sections',
      createdCount: 0,
      children: [],
      message: 'No keys matching section pattern found in JSON response',
    };
  }

  // Sort keys naturally (section 01, section 02, etc.)
  sectionKeys.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
    return numA - numB;
  });

  // Get default settings
  const defaults = await getDefaultSettings(supabase);
  
  // Get model defaults if a default model is set
  const modelDefaults = await getModelDefaults(supabase, defaults.default_model);
  
  // Get action prompt settings to inherit (used when no matching API settings)
  const actionPromptSettings = await getPromptSettings(supabase, prompt.row_id);

  // Get library prompt if specified
  const libraryPrompt = await getLibraryPrompt(supabase, copy_library_prompt_id);

  // Determine parent_row_id based on placement
  let targetParentRowId;
  switch (placement) {
    case 'children':
      targetParentRowId = prompt.row_id;
      break;
    case 'siblings':
      targetParentRowId = prompt.parent_row_id;
      break;
    case 'top_level':
      targetParentRowId = null;
      break;
    default:
      targetParentRowId = prompt.row_id;
  }

  // Get current max position among target siblings
  const { data: siblings } = await supabase
    .from(PROMPTS_TABLE)
    .select('position')
    .eq('parent_row_id', targetParentRowId)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (siblings?.[0]?.position ?? -1) + 1;

  // For top-level, we need different query
  if (placement === 'top_level') {
    const { data: topLevel } = await supabase
      .from(PROMPTS_TABLE)
      .select('position')
      .is('parent_row_id', null)
      .order('position', { ascending: false })
      .limit(1);
    nextPosition = (topLevel?.[0]?.position ?? -1) + 1;
  }

  const createdChildren = [];

  for (const sectionKey of sectionKeys) {
    const sectionValue = jsonResponse[sectionKey];
    
    // Determine child name based on name_source
    let childName;
    switch (name_source) {
      case 'key_name':
        childName = sectionKey;
        break;
      case 'both':
        childName = `${sectionKey}: ${typeof sectionValue === 'string' ? sectionValue : JSON.stringify(sectionValue)}`;
        break;
      case 'key_value':
      default:
        childName = typeof sectionValue === 'string' ? sectionValue : JSON.stringify(sectionValue);
        break;
    }

    // Look for corresponding content key
    let content = '';
    if (contentSuffixLower) {
      const contentKey = `${sectionKey} ${content_key_suffix}`;
      // Try exact match first
      const matchingKey = Object.keys(jsonResponse).find(
        k => k.toLowerCase() === contentKey.toLowerCase()
      );
      if (matchingKey) {
        const contentValue = jsonResponse[matchingKey];
        content = typeof contentValue === 'string' ? contentValue : JSON.stringify(contentValue, null, 2);
      }
    }

    // Build child data with proper inheritance from action prompt settings
    const childData = {
      parent_row_id: targetParentRowId,
      prompt_name: String(childName).substring(0, 100),
      input_admin_prompt: libraryPrompt?.content || content || actionPromptSettings.input_admin_prompt || defaults.def_admin_prompt || '',
      input_user_prompt: content ? '' : (typeof sectionValue === 'string' ? sectionValue : ''),
      position: nextPosition++,
      owner_id: context.userId || prompt.owner_id,
      node_type: 'standard',
      // Store section data for reference
      extracted_variables: { 
        section_key: sectionKey, 
        section_value: sectionValue,
        has_content: !!content 
      },
      // Inherit from action prompt if no specific API settings
      model: actionPromptSettings.model || modelDefaults.model,
      model_on: actionPromptSettings.model_on ?? modelDefaults.model_on,
      temperature: actionPromptSettings.temperature ?? modelDefaults.temperature,
      temperature_on: actionPromptSettings.temperature_on ?? modelDefaults.temperature_on,
      max_tokens: actionPromptSettings.max_tokens ?? modelDefaults.max_tokens,
      max_tokens_on: actionPromptSettings.max_tokens_on ?? modelDefaults.max_tokens_on,
      web_search_on: actionPromptSettings.web_search_on,
      confluence_enabled: actionPromptSettings.confluence_enabled,
      thread_mode: actionPromptSettings.thread_mode,
      child_thread_strategy: actionPromptSettings.child_thread_strategy,
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
      console.error('Error creating child node from section:', error);
      throw error;
    }

    createdChildren.push(data);
  }

  const placementText = {
    children: 'as children of this prompt',
    siblings: 'at the same level',
    top_level: 'as top-level prompts',
  };

  return {
    action: 'create_children_sections',
    createdCount: createdChildren.length,
    children: createdChildren,
    placement,
    sectionKeys,
    message: `Created ${createdChildren.length} prompt(s) ${placementText[placement]} from section keys`,
  };
};
