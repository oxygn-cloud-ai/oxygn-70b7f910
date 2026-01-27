-- ============================================================
-- Jira and Figma Integration Tables
-- ============================================================

-- Jira Projects (cache for UI dropdowns)
CREATE TABLE IF NOT EXISTS q_jira_projects (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  project_key TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Jira Issues (attached to prompts)
CREATE TABLE IF NOT EXISTS q_jira_issues (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_row_id UUID REFERENCES q_prompts(row_id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  status TEXT,
  issue_type TEXT,
  priority TEXT,
  labels JSONB DEFAULT '[]'::jsonb,
  project_key TEXT,
  project_name TEXT,
  issue_url TEXT,
  sync_status TEXT DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Figma Files (attached to prompts)
CREATE TABLE IF NOT EXISTS q_figma_files (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_row_id UUID REFERENCES q_prompts(row_id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  file_name TEXT,
  thumbnail_url TEXT,
  last_modified TIMESTAMPTZ,
  version TEXT,
  sync_status TEXT DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_jira_issues_prompt ON q_jira_issues(prompt_row_id);
CREATE INDEX IF NOT EXISTS idx_jira_issues_key ON q_jira_issues(issue_key);
CREATE INDEX IF NOT EXISTS idx_figma_files_prompt ON q_figma_files(prompt_row_id);
CREATE INDEX IF NOT EXISTS idx_figma_files_key ON q_figma_files(file_key);
CREATE INDEX IF NOT EXISTS idx_jira_projects_key ON q_jira_projects(project_key);

-- Enable Row Level Security
ALTER TABLE q_jira_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE q_jira_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE q_figma_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for q_jira_projects (read-only cache)
CREATE POLICY "Domain users can read jira projects" 
  ON q_jira_projects FOR SELECT 
  USING (current_user_has_allowed_domain());

CREATE POLICY "Domain users can insert jira projects" 
  ON q_jira_projects FOR INSERT 
  WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Domain users can update jira projects" 
  ON q_jira_projects FOR UPDATE 
  USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can delete jira projects" 
  ON q_jira_projects FOR DELETE 
  USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));

-- RLS Policies for q_jira_issues
CREATE POLICY "Domain users can read jira issues" 
  ON q_jira_issues FOR SELECT 
  USING (current_user_has_allowed_domain());

CREATE POLICY "Domain users can insert jira issues" 
  ON q_jira_issues FOR INSERT 
  WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Domain users can update jira issues" 
  ON q_jira_issues FOR UPDATE 
  USING (current_user_has_allowed_domain());

CREATE POLICY "Domain users can delete jira issues" 
  ON q_jira_issues FOR DELETE 
  USING (current_user_has_allowed_domain());

-- RLS Policies for q_figma_files
CREATE POLICY "Domain users can read figma files" 
  ON q_figma_files FOR SELECT 
  USING (current_user_has_allowed_domain());

CREATE POLICY "Domain users can insert figma files" 
  ON q_figma_files FOR INSERT 
  WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Domain users can update figma files" 
  ON q_figma_files FOR UPDATE 
  USING (current_user_has_allowed_domain());

CREATE POLICY "Domain users can delete figma files" 
  ON q_figma_files FOR DELETE 
  USING (current_user_has_allowed_domain());

-- Triggers for updated_at
CREATE TRIGGER update_jira_projects_updated_at
  BEFORE UPDATE ON q_jira_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jira_issues_updated_at
  BEFORE UPDATE ON q_jira_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_figma_files_updated_at
  BEFORE UPDATE ON q_figma_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();