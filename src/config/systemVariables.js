/**
 * System Template Variables Configuration
 * 
 * All system variables use the `q.` prefix and are categorized as:
 * - static: Auto-populated at runtime (user cannot edit)
 * - user_editable: User can edit in the Variables tab (stored in system_variables JSONB)
 * - input: User provides value when creating from template
 * - select: User selects from predefined options
 */

export const SYSTEM_VARIABLE_TYPES = {
  STATIC: 'static',
  USER_EDITABLE: 'user_editable',
  INPUT: 'input',
  SELECT: 'select',
  RUNTIME: 'runtime',
};

/**
 * System variable definitions
 * These cannot be deleted or amended by users in the template editor
 */
export const SYSTEM_VARIABLES = {
  // Date/Time variables (static - auto-populated)
  'q.today': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Today',
    description: 'Current date (YYYY-MM-DD)',
    getValue: () => new Date().toISOString().split('T')[0],
  },
  'q.now': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Now',
    description: 'Current date and time',
    getValue: () => new Date().toISOString(),
  },
  'q.year': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Year',
    description: 'Current year',
    getValue: () => new Date().getFullYear().toString(),
  },
  'q.month': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Month',
    description: 'Current month name',
    getValue: () => new Date().toLocaleString('default', { month: 'long' }),
  },

  // User variables (static - auto-populated from auth context)
  'q.user.name': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'User Name',
    description: 'Current user display name',
    getValue: (context) => context?.user?.display_name || context?.user?.email?.split('@')[0] || 'Unknown',
  },
  'q.user.email': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'User Email',
    description: 'Current user email address',
    getValue: (context) => context?.user?.email || '',
  },

  // Prompt context variables (static - auto-populated during execution)
  'q.prompt.name': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Prompt Name',
    description: 'Name of the current prompt',
    getValue: (context) => context?.promptName || '',
  },
  'q.toplevel.prompt.name': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Top Level Prompt Name',
    description: 'Name of the top-level prompt being created',
    getValue: (context) => context?.topLevelPromptName || '',
  },
  'q.parent.prompt.name': {
    type: SYSTEM_VARIABLE_TYPES.STATIC,
    label: 'Parent Prompt Name',
    description: 'Name of the parent prompt (for child prompts)',
    getValue: (context) => context?.parentPromptName || '',
  },

  // User-editable policy variables (stored in prompt's system_variables field)
  'q.policy.version': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    label: 'Policy Version',
    description: 'Version of the policy',
    placeholder: 'e.g., 1.0, 2.1',
  },
  'q.policy.owner': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    label: 'Policy Owner',
    description: 'Owner or responsible party for the policy',
    placeholder: 'Enter policy owner',
  },
  'q.policy.effective.date': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    label: 'Effective Date',
    description: 'When the policy becomes effective',
    placeholder: 'YYYY-MM-DD',
  },
  'q.policy.review.date': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    label: 'Review Date',
    description: 'Next scheduled review date',
    placeholder: 'YYYY-MM-DD',
  },
  'q.client.name': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    label: 'Client Name',
    description: 'Name of the client or organization',
    placeholder: 'Enter client name',
  },
  'q.jurisdiction': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    label: 'Jurisdiction',
    description: 'Legal jurisdiction',
    placeholder: 'e.g., Singapore, Hong Kong',
  },
  'q.topic': {
    type: SYSTEM_VARIABLE_TYPES.USER_EDITABLE,
    inputType: 'select',
    label: 'Topic',
    description: 'Policy topic category',
    options: [
      'Purpose',
      'Nature of the Firm',
      'Regulatory Alignment - SG',
      'Regulatory Alignment - HK',
      'Regulatory Alignment - JP',
      'Regulatory Alignment - UAE',
      'Scope',
      'Board Accountability',
      'Senior Management Accountability',
      'Employee Accountability',
      'Records Keeping',
      'Non-Compliance Consequences',
      'Training and Preparedness',
    ],
  },

  // Cascade runtime variables (only available during cascade execution)
  'q.previous.response': {
    type: SYSTEM_VARIABLE_TYPES.RUNTIME,
    label: 'Previous Response',
    description: 'AI response from previous prompt in cascade (runtime only)',
    runtimeOnly: true,
  },
  'q.previous.name': {
    type: SYSTEM_VARIABLE_TYPES.RUNTIME,
    label: 'Previous Prompt Name',
    description: 'Name of previous prompt in cascade (runtime only)',
    runtimeOnly: true,
  },
};

/**
 * Get all system variable names
 */
export const getSystemVariableNames = () => Object.keys(SYSTEM_VARIABLES);

/**
 * Check if a variable is a system variable
 */
export const isSystemVariable = (varName) => varName.startsWith('q.');

/**
 * Get system variable definition
 */
export const getSystemVariable = (varName) => SYSTEM_VARIABLES[varName];

/**
 * Check if a system variable is static (auto-populated)
 */
export const isStaticSystemVariable = (varName) => {
  const def = SYSTEM_VARIABLES[varName];
  return def?.type === SYSTEM_VARIABLE_TYPES.STATIC;
};

/**
 * Check if a system variable is user-editable
 */
export const isUserEditableVariable = (varName) => {
  const def = SYSTEM_VARIABLES[varName];
  return def?.type === SYSTEM_VARIABLE_TYPES.USER_EDITABLE;
};

/**
 * Get all user-editable variables
 */
export const getUserEditableVariables = () => {
  return Object.entries(SYSTEM_VARIABLES)
    .filter(([_, def]) => def.type === SYSTEM_VARIABLE_TYPES.USER_EDITABLE)
    .map(([name, def]) => ({ name, ...def }));
};

/**
 * Check if a system variable requires user input
 */
export const isInputSystemVariable = (varName) => {
  const def = SYSTEM_VARIABLES[varName];
  return def?.type === SYSTEM_VARIABLE_TYPES.INPUT || def?.type === SYSTEM_VARIABLE_TYPES.SELECT;
};

/**
 * Resolve all static system variables
 */
export const resolveStaticVariables = (context = {}) => {
  const resolved = {};
  Object.entries(SYSTEM_VARIABLES).forEach(([name, def]) => {
    if (def.type === SYSTEM_VARIABLE_TYPES.STATIC && def.getValue) {
      resolved[name] = def.getValue(context);
    }
  });
  return resolved;
};

/**
 * Get input variables that need user values
 */
export const getInputVariables = (variableNames) => {
  return variableNames.filter(name => {
    const def = SYSTEM_VARIABLES[name];
    return def && (def.type === SYSTEM_VARIABLE_TYPES.INPUT || def.type === SYSTEM_VARIABLE_TYPES.SELECT);
  });
};

/**
 * Categorize extracted variables into system and user variables
 */
export const categorizeVariables = (variableNames) => {
  const systemStatic = [];
  const systemUserEditable = [];
  const systemInput = [];
  const systemRuntime = [];
  const userDefined = [];

  variableNames.forEach(name => {
    if (isSystemVariable(name)) {
      const def = SYSTEM_VARIABLES[name];
      if (def?.type === SYSTEM_VARIABLE_TYPES.STATIC) {
        systemStatic.push(name);
      } else if (def?.type === SYSTEM_VARIABLE_TYPES.USER_EDITABLE) {
        systemUserEditable.push(name);
      } else if (def?.type === SYSTEM_VARIABLE_TYPES.RUNTIME) {
        // Runtime variables are only available during cascade - don't show as input
        systemRuntime.push(name);
      } else if (def) {
        systemInput.push(name);
      } else {
        // Unknown q.* variable - treat as user input
        systemInput.push(name);
      }
    } else {
      userDefined.push(name);
    }
  });

  return { systemStatic, systemUserEditable, systemInput, systemRuntime, userDefined };
};
