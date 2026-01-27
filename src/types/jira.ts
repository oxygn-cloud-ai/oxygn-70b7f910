/**
 * Jira Integration Types
 * TypeScript interfaces for Jira API responses and database records
 */

// ============================================================================
// Jira API Response Types
// ============================================================================

export interface JiraApiProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: {
    '48x48'?: string;
    '24x24'?: string;
    '16x16'?: string;
    '32x32'?: string;
  };
}

export interface JiraApiIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: any;
    status?: { name: string };
    issuetype?: { name: string };
    priority?: { name: string };
    labels?: string[];
    project?: { key: string; name: string };
    created?: string;
    updated?: string;
  };
}

// ============================================================================
// Database Record Types
// ============================================================================

export interface JiraProject {
  row_id: string;
  project_id: string;
  project_key: string;
  project_name: string;
  project_type: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface JiraIssue {
  row_id: string;
  prompt_row_id: string | null;
  issue_id: string;
  issue_key: string;
  summary: string | null;
  description: string | null;
  status: string | null;
  issue_type: string | null;
  priority: string | null;
  labels: string[];
  project_key: string | null;
  project_name: string | null;
  issue_url: string | null;
  sync_status: string;
  last_synced_at: string | null;
  position: number | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// Action Configuration Types
// ============================================================================

export interface CreateJiraTicketConfig {
  project_key: string;
  issue_type: string;
  summary_template?: string;
  description_template?: string;
  labels?: string[];
  priority?: string;
}

export interface CreateJiraTicketContext {
  response: string;
  variables: Record<string, string>;
  promptRowId: string;
}

export interface CreateJiraTicketResult {
  success: boolean;
  issueKey?: string;
  issueUrl?: string;
  error?: string;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseJiraIssuesReturn {
  issues: JiraIssue[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  fetchAttachedIssues: (promptRowId: string) => Promise<void>;
  attachIssue: (issueKey: string, promptRowId: string) => Promise<boolean>;
  detachIssue: (rowId: string) => Promise<boolean>;
  syncIssue: (rowId: string) => Promise<boolean>;
}
