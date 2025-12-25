/**
 * Create Children (Text) Action Executor
 * 
 * Creates a specified number of child nodes with optional content from library prompts.
 */

const PROMPTS_TABLE = 'q_prompts';

/**
 * Get default prompt settings from the database
 */
const getDefaultSettings = async (supabase) => {
  const { data } = await supabase
    .from('q_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['default_prompt_instructions', 'default_user_prompt']);

  const settings = {};
  data?.forEach(row => {
    settings[row.setting_key] = row.setting_value;
  });
  return settings;
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
 * Execute the create children text action
 */
export const executeCreateChildrenText = async ({
  supabase,
  prompt,
  jsonResponse,
  config,
  context,
}) => {
  const {
    children_count = 3,
    name_prefix = 'Child',
    copy_library_prompt_id,
  } = config || {};

  // Get default settings
  const defaults = await getDefaultSettings(supabase);
  
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

  for (let i = 0; i < children_count; i++) {
    const childName = `${name_prefix} ${i + 1}`;
    
    const childData = {
      parent_row_id: prompt.row_id,
      prompt_name: childName,
      input_admin_prompt: libraryPrompt?.content || defaults.default_prompt_instructions || '',
      input_user_prompt: defaults.default_user_prompt || '',
      position: nextPosition++,
      owner_id: context.userId || prompt.owner_id,
      node_type: 'standard',
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
      console.error('Error creating child node:', error);
      throw error;
    }

    createdChildren.push(data);
  }

  return {
    action: 'create_children_text',
    createdCount: createdChildren.length,
    children: createdChildren,
    message: `Created ${createdChildren.length} child node(s)`,
  };
};
