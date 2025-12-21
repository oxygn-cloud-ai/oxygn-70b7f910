/**
 * Centralized tooltip and label configuration
 * All user-facing tooltip text should be defined here for consistency and maintainability.
 */

export const TOOLTIPS = {
  // ============================================
  // Actions - Common action tooltips
  // ============================================
  actions: {
    save: 'Save changes',
    noChanges: 'No changes to save',
    refresh: 'Refresh',
    add: 'Add',
    delete: 'Delete',
    duplicate: 'Duplicate',
    rename: 'Rename',
    copy: 'Copy',
    export: 'Export',
    import: 'Import',
    cancel: 'Cancel',
    confirm: 'Confirm',
    edit: 'Edit',
    create: 'Create',
    close: 'Close',
  },

  // ============================================
  // Templates
  // ============================================
  templates: {
    stats: {
      promptNodes: 'Prompt nodes',
      variables: 'Variables',
      created: 'Created',
    },
    actions: {
      create: 'Create template',
      import: 'Import template',
      export: 'Export template',
      duplicate: 'Duplicate',
      delete: 'Delete',
      refreshVariables: 'Refresh detected variables',
      addVariable: 'Add variable',
    },
    variables: {
      used: 'Used in prompts',
      unused: 'Not used in any prompt',
    },
  },

  // ============================================
  // Chat & Messages
  // ============================================
  chat: {
    copy: 'Copy',
    helpful: 'Helpful',
    notHelpful: 'Not helpful',
    regenerate: 'Regenerate',
    attachments: 'Attachments coming soon',
    newConversation: 'New conversation',
  },

  // ============================================
  // Threads
  // ============================================
  threads: {
    viewHistory: 'View History',
    createNew: 'Create new thread',
    delete: 'Delete thread',
    rename: 'Rename',
  },

  // ============================================
  // Prompts & Tree
  // ============================================
  prompts: {
    addChild: 'Add child prompt',
    createNew: 'Create new prompt',
    enableAssistant: 'Enable Assistant Mode',
    assistant: {
      active: 'Assistant • Ready',
    },
  },

  // ============================================
  // Variables
  // ============================================
  variables: {
    insert: 'Insert variable',
  },

  // ============================================
  // Settings
  // ============================================
  settings: {
    addModel: 'Add Model',
    addSetting: 'Add Setting',
    addSecret: 'Add Secret',
    updateSecret: 'Update Secret',
    saveCredentials: 'Save',
    verifyCredentials: 'Verify your Confluence credentials',
    cycleValues: (count) => `Cycle through previous values (${count} saved)`,
    notAvailable: 'This setting is not available for the selected model',
    notSupported: 'Not supported by selected model',
    deleteFromOpenAI: 'Delete from OpenAI',
    noLinkedPrompt: 'This assistant has no linked prompt in the system',
  },

  // ============================================
  // Navigation & General
  // ============================================
  navigation: {
    signOut: 'Sign out',
  },

  // ============================================
  // Background/System
  // ============================================
  system: {
    apiCallsInProgress: 'API calls are running. They will complete even if you navigate away.',
  },

  // ============================================
  // Confluence
  // ============================================
  confluence: {
    openInConfluence: 'Open in Confluence',
    refreshContent: 'Refresh Content',
    uploadToOpenAI: 'Upload to OpenAI',
    detachPage: 'Detach Page',
    browse: 'Browse Confluence',
  },

  // ============================================
  // Ownership
  // ============================================
  ownership: {
    ownedBy: (name) => `Owned by ${name}`,
    clickToChange: 'Click to change owner',
  },
};

export default TOOLTIPS;
