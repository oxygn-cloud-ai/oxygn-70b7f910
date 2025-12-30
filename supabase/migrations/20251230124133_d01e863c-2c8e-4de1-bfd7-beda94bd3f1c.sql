-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- KNOWLEDGE BASE TABLES
-- =====================================================

-- Main knowledge content table with vector embeddings
CREATE TABLE public.q_app_knowledge (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[],
  priority INTEGER DEFAULT 0,
  embedding vector(1536),
  is_active BOOLEAN DEFAULT true,
  is_auto_generated BOOLEAN DEFAULT false,
  source_type TEXT,
  source_id TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Create index for vector similarity search
CREATE INDEX ON public.q_app_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for topic filtering
CREATE INDEX idx_knowledge_topic ON public.q_app_knowledge(topic);
CREATE INDEX idx_knowledge_active ON public.q_app_knowledge(is_active);

-- Knowledge edit history for auditing
CREATE TABLE public.q_app_knowledge_history (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_row_id UUID REFERENCES public.q_app_knowledge(row_id) ON DELETE CASCADE,
  topic TEXT,
  title TEXT,
  content TEXT,
  version INTEGER,
  edited_at TIMESTAMPTZ DEFAULT now(),
  edited_by UUID
);

-- =====================================================
-- PROMPT FAMILY CHAT TABLES
-- =====================================================

-- Chat threads for prompt families
CREATE TABLE public.q_prompt_family_threads (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_row_id UUID NOT NULL REFERENCES public.q_prompts(row_id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  openai_conversation_id TEXT,
  is_active BOOLEAN DEFAULT true,
  owner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages for prompt family chat
CREATE TABLE public.q_prompt_family_messages (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_row_id UUID REFERENCES public.q_prompt_family_threads(row_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for prompt family tables
CREATE INDEX idx_family_threads_prompt ON public.q_prompt_family_threads(prompt_row_id);
CREATE INDEX idx_family_messages_thread ON public.q_prompt_family_messages(thread_row_id);

-- =====================================================
-- SEMANTIC SEARCH FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_topics text[] DEFAULT NULL
)
RETURNS TABLE (
  row_id uuid,
  topic text,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.row_id,
    k.topic,
    k.title,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  FROM public.q_app_knowledge k
  WHERE k.is_active = true
    AND k.embedding IS NOT NULL
    AND (filter_topics IS NULL OR k.topic = ANY(filter_topics))
    AND 1 - (k.embedding <=> query_embedding) > match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- RLS POLICIES - KNOWLEDGE
-- =====================================================

ALTER TABLE public.q_app_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.q_app_knowledge_history ENABLE ROW LEVEL SECURITY;

-- Anyone with allowed domain can read active knowledge
CREATE POLICY "Domain users can read active knowledge"
ON public.q_app_knowledge FOR SELECT
USING (is_active = true AND current_user_has_allowed_domain());

-- Admins can do everything with knowledge
CREATE POLICY "Admins can manage knowledge"
ON public.q_app_knowledge FOR ALL
USING (is_admin(auth.uid()));

-- History readable by admins only
CREATE POLICY "Admins can read knowledge history"
ON public.q_app_knowledge_history FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert knowledge history"
ON public.q_app_knowledge_history FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- =====================================================
-- RLS POLICIES - PROMPT FAMILY CHAT
-- =====================================================

ALTER TABLE public.q_prompt_family_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.q_prompt_family_messages ENABLE ROW LEVEL SECURITY;

-- Threads: domain users can insert
CREATE POLICY "Domain users can insert prompt family threads"
ON public.q_prompt_family_threads FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

-- Threads: owners and admins can read
CREATE POLICY "Users can read own prompt family threads"
ON public.q_prompt_family_threads FOR SELECT
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

-- Threads: owners and admins can update
CREATE POLICY "Users can update own prompt family threads"
ON public.q_prompt_family_threads FOR UPDATE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

-- Threads: owners and admins can delete
CREATE POLICY "Users can delete own prompt family threads"
ON public.q_prompt_family_threads FOR DELETE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

-- Messages: domain users can insert
CREATE POLICY "Domain users can insert prompt family messages"
ON public.q_prompt_family_messages FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

-- Messages: read if own thread
CREATE POLICY "Users can read messages in own threads"
ON public.q_prompt_family_messages FOR SELECT
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.q_prompt_family_threads t
    WHERE t.row_id = q_prompt_family_messages.thread_row_id
    AND t.owner_id = auth.uid()
  )
));

-- Messages: delete if own thread
CREATE POLICY "Users can delete messages in own threads"
ON public.q_prompt_family_messages FOR DELETE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.q_prompt_family_threads t
    WHERE t.row_id = q_prompt_family_messages.thread_row_id
    AND t.owner_id = auth.uid()
  )
));

-- =====================================================
-- SEED KNOWLEDGE DATA
-- =====================================================

-- Overview
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('overview', 'What is Qonsol', E'Qonsol is a prompt management platform for building, organizing, and running AI prompts at scale.\n\n## Key Concepts\n- **Prompts**: Individual AI instructions with system prompts, user prompts, and model settings\n- **Prompt Families**: Hierarchical trees of prompts that work together\n- **Templates**: Reusable prompt structures with variable definitions\n- **Cascade Runs**: Execute entire prompt trees in sequence\n\n## 4-Panel Layout\n1. **Navigation Rail** (64px) - Primary navigation icons\n2. **Folder Panel** (256px) - Lists, trees, item selection\n3. **Reading Pane** (flex) - Main content area, forms, details\n4. **Conversation Panel** (384px) - Chat/AI interactions', ARRAY['intro', 'start', 'what is', 'overview', 'getting started'], 100),

('overview', 'Getting Started', E'## Quick Start\n\n1. **Create a Prompt**: Click + in the folder panel to create a new top-level prompt\n2. **Write Content**: Add a system prompt (instructions) and user prompt (the actual request)\n3. **Configure Model**: Select an AI model and adjust settings like temperature\n4. **Run**: Click the Run button to execute and see the response\n5. **Add Children**: Create child prompts that can reference parent outputs using {{q.parent_output}}\n\n## Tips\n- Use variables like {{variable_name}} for dynamic content\n- Star important prompts for quick access\n- Use templates to create consistent prompt structures', ARRAY['start', 'quick', 'create', 'first'], 95),

('overview', 'Understanding the Interface', E'## Panel Overview\n\n### Navigation Rail\nThe leftmost column with icons for:\n- Prompts (main workspace)\n- Workbench (free-form chat)\n- Library (saved prompts)\n- Templates (reusable structures)\n- Settings (configuration)\n\n### Folder Panel\nShows the prompt tree structure. Click prompts to select, drag to reorder, use context menu for actions.\n\n### Reading Pane\nMain editing area showing prompt details, settings tabs, and the output area.\n\n### Conversation Panel\nChat interface for interacting with AI about your prompt family. Different from running prompts - this is for asking questions and exploring.', ARRAY['interface', 'layout', 'panels', 'navigation'], 90);

-- Prompts
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('prompts', 'Creating Prompts', E'## Creating a New Prompt\n\n1. Click the **+** button in the folder panel header\n2. Or right-click an existing prompt and select "Add Child"\n3. Or use a template to create a structured prompt family\n\n## Prompt Fields\n- **Name**: Display name shown in the tree\n- **System Prompt**: Instructions for the AI (context, persona, rules)\n- **User Prompt**: The actual request or question\n- **Note**: Internal notes, not sent to AI\n\n## Node Types\n- **Standard**: Regular prompts that generate text output\n- **Action**: Special prompts that create child nodes from structured output', ARRAY['create', 'new', 'prompt', 'add'], 90),

('prompts', 'Running Prompts', E'## Execution Methods\n\n### Single Run\nClick the **Run** button to execute just the selected prompt. The AI response appears in the output area.\n\n### Cascade Run\nClick **Run Cascade** on a top-level prompt to execute the entire tree in order. Each prompt runs, and its output becomes available to children via {{q.parent_output}}.\n\n## Run States\n- **Running**: Prompt is being processed\n- **Complete**: Response received\n- **Error**: Something went wrong (check the error message)\n- **Skipped**: Prompt was excluded or skipped during cascade', ARRAY['run', 'execute', 'cascade', 'start'], 85),

('prompts', 'Prompt Hierarchy', E'## Parent-Child Relationships\n\nPrompts can be organized in a tree structure:\n\n```\nTop-Level Prompt\n├── Child Prompt 1\n│   └── Grandchild Prompt\n├── Child Prompt 2\n└── Child Prompt 3\n```\n\n## Benefits\n- Children can reference parent output: {{q.parent_output}}\n- Cascade runs execute in depth-first order\n- Organize complex workflows into logical steps\n\n## Moving Prompts\n- Drag and drop to reorder or change parents\n- Use "Move to Top Level" to promote a child\n- Cut/paste for more control', ARRAY['hierarchy', 'parent', 'child', 'tree', 'structure'], 80),

('prompts', 'Prompt Settings', E'## Model Settings\n\n- **Model**: Select the AI model (GPT-4o, GPT-4o-mini, o1, o3-mini, etc.)\n- **Temperature**: Creativity level (0 = deterministic, 1 = creative)\n- **Max Tokens**: Maximum response length\n- **Top P**: Alternative to temperature for sampling\n\n## Tool Settings\n- **Web Search**: Enable real-time web search\n- **File Search**: Search attached files\n- **Code Interpreter**: Execute Python code\n\n## Advanced\n- **Reasoning Effort**: For o-series models (low/medium/high)\n- **JSON Schema**: Force structured output format\n- **Exclude from Cascade**: Skip this prompt in cascade runs', ARRAY['settings', 'model', 'temperature', 'tokens', 'configure'], 80),

('prompts', 'Prompt Output', E'## Output Area\n\nThe response from the AI appears in the output section below the prompt fields.\n\n## Output Features\n- **Copy**: Copy the entire response\n- **Expand**: View in larger area\n- **Markdown**: Rendered with proper formatting\n- **JSON**: Syntax highlighted for structured responses\n\n## Referencing Output\nChild prompts can reference parent output:\n- {{q.parent_output}} - Full parent response\n- {{q.parent_name}} - Parent prompt name\n- For action nodes, output is parsed as JSON and used to create children', ARRAY['output', 'response', 'result'], 75);

-- Variables
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('variables', 'Variable Syntax', E'## Basic Variables\n\nUse double curly braces: {{variable_name}}\n\nVariables are replaced before sending to the AI.\n\n## Example\n```\nWrite a {{tone}} blog post about {{topic}}.\n```\n\nWith values tone="professional" and topic="AI trends", becomes:\n```\nWrite a professional blog post about AI trends.\n```', ARRAY['variable', 'syntax', 'curly', 'braces'], 85),

('variables', 'System Variables (q.*)', E'## Built-in System Variables\n\nQonsol provides special variables prefixed with `q.`:\n\n| Variable | Description |\n|----------|-------------|\n| {{q.parent_output}} | Output from parent prompt |\n| {{q.parent_name}} | Name of parent prompt |\n| {{q.current_date}} | Today''s date |\n| {{q.current_time}} | Current time |\n| {{q.prompt_name}} | Current prompt name |\n| {{q.user_email}} | Current user''s email |\n\n## Usage\n```\nBased on this context:\n{{q.parent_output}}\n\nProvide a summary for {{q.current_date}}.\n```', ARRAY['system', 'q.', 'parent', 'output', 'date'], 90),

('variables', 'User Variables', E'## Creating User Variables\n\n1. Go to the Variables tab on a prompt\n2. Click "Add Variable"\n3. Enter name, default value, and description\n\n## Variable Properties\n- **Name**: The identifier (used as {{name}})\n- **Default Value**: Used if no value provided\n- **Value**: Current/override value\n- **Required**: Must have a value to run\n\n## Inheritance\nChild prompts inherit parent variables. Override by defining the same variable name on the child.', ARRAY['user', 'custom', 'create', 'define'], 80),

('variables', 'Prompt References', E'## Referencing Other Prompts\n\nReference output from any prompt in the family:\n\n```\n{{ref:Prompt Name}}\n```\n\nOr by position:\n```\n{{ref:../sibling}} - Sibling prompt\n{{ref:./child}} - Child prompt\n```\n\n## Use Cases\n- Combine outputs from multiple branches\n- Reference a summary prompt from elsewhere\n- Build complex data flows between prompts', ARRAY['reference', 'ref', 'other', 'prompt'], 75),

('variables', 'Variable Resolution Order', E'## How Variables Are Resolved\n\n1. **Explicit Value**: Value set directly on the variable\n2. **Parent Value**: Inherited from parent prompt\n3. **Default Value**: Fallback if no other value\n4. **Empty**: Left as {{variable}} if unresolved\n\n## Tips\n- Check the Variables tab to see resolved values\n- Unresolved variables are highlighted in the prompt editor\n- System variables are always available', ARRAY['resolve', 'order', 'inherit', 'fallback'], 70);

-- Templates
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('templates', 'What are Templates', E'## Template Overview\n\nTemplates are reusable prompt family structures. They define:\n- Prompt hierarchy (parent/child relationships)\n- Default content for each prompt\n- Variable definitions with defaults\n- Model and tool configurations\n\n## Benefits\n- Create consistent prompt structures\n- Share proven patterns across projects\n- Quickly scaffold complex workflows', ARRAY['template', 'what', 'overview'], 85),

('templates', 'Creating from Template', E'## Using a Template\n\n1. Click **+ New** in the folder panel\n2. Select **From Template**\n3. Browse or search available templates\n4. Click to preview the structure\n5. Click **Use Template** to create\n\n## After Creation\n- A new prompt family is created with the template structure\n- All prompts are copies - changes don''t affect the template\n- Fill in the template variables to customize', ARRAY['create', 'use', 'from', 'new'], 80),

('templates', 'Template Variables', E'## Template Variable Definitions\n\nTemplates can define variables that must be filled when used:\n\n```json\n{\n  "topic": {\n    "description": "Main topic for the content",\n    "default": "",\n    "required": true\n  },\n  "tone": {\n    "description": "Writing tone",\n    "default": "professional",\n    "required": false\n  }\n}\n```\n\n## At Creation Time\nUsers are prompted to fill required variables before the family is created.', ARRAY['variable', 'definition', 'require'], 75),

('templates', 'Creating Templates', E'## Saving as Template\n\n1. Build your prompt family structure\n2. Select the top-level prompt\n3. Click **Save as Template** in the menu\n4. Enter name, description, and category\n5. Define any template variables\n\n## Template Structure\nThe entire prompt tree is saved, including:\n- All prompts and hierarchy\n- Prompt content and settings\n- Variable definitions\n- Model configurations', ARRAY['save', 'create', 'new'], 75);

-- JSON Schemas
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('json_schemas', 'Structured Output', E'## What is Structured Output\n\nJSON Schemas force the AI to respond in a specific format. Instead of free text, you get predictable JSON.\n\n## Example Schema\n```json\n{\n  "type": "object",\n  "properties": {\n    "title": {"type": "string"},\n    "sections": {\n      "type": "array",\n      "items": {"type": "string"}\n    }\n  },\n  "required": ["title", "sections"]\n}\n```\n\n## Benefits\n- Guaranteed valid JSON\n- Consistent structure for parsing\n- Required for action nodes', ARRAY['json', 'schema', 'structured', 'format'], 85),

('json_schemas', 'Action Nodes', E'## What are Action Nodes\n\nAction nodes are special prompts that:\n1. Generate structured JSON output\n2. Automatically create child prompts from the output\n\n## Example Flow\n1. Action node generates: `{"sections": ["Intro", "Body", "Conclusion"]}`\n2. Three child prompts are created automatically\n3. Each child has the section name and can expand on it\n\n## Setting Up\n1. Set node_type to "action"\n2. Attach a JSON schema\n3. Configure the post_action and post_action_config', ARRAY['action', 'node', 'automatic', 'create'], 85),

('json_schemas', 'Schema Templates', E'## Reusable Schema Templates\n\nCreate schema templates to reuse common structures:\n\n1. Go to Templates > JSON Schemas\n2. Click "New Schema Template"\n3. Define the schema structure\n4. Configure model and action settings\n5. Save for reuse\n\n## Template Features\n- **Schema**: The JSON structure\n- **System Prompt Template**: Default instructions\n- **Child Creation**: How to create children from output\n- **Model Config**: Default model settings', ARRAY['schema', 'template', 'reuse'], 75),

('json_schemas', 'Child Creation Options', E'## Post-Action Types\n\n### create_children_json\nCreate children from a JSON array:\n- **json_path**: Path to array (e.g., "sections")\n- **name_field**: Field for child name\n- **content_field**: Field for child content\n\n### create_children_sections\nCreate children from regex-matched sections:\n- **section_pattern**: Regex to find sections\n- **content_pattern**: Regex for content\n\n### create_children_text\nCreate fixed number of children:\n- **children_count**: Number to create\n- **name_prefix**: Prefix for names', ARRAY['child', 'creation', 'action', 'config'], 80);

-- Files
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('files', 'Attaching Files', E'## Adding Files to Prompts\n\n1. Select a prompt\n2. Go to the Files tab (or use the attachment button)\n3. Click "Upload File" or drag and drop\n4. File is uploaded and synced to OpenAI\n\n## Supported Types\n- Documents: PDF, DOCX, TXT, MD\n- Code: JS, PY, JSON, etc.\n- Images: PNG, JPG, GIF (for vision models)\n\n## File Search\nEnable "File Search" in tool settings to let the AI search file contents.', ARRAY['file', 'attach', 'upload', 'add'], 80),

('files', 'File Sync Status', E'## Sync States\n\n- **Pending**: File uploaded, waiting to sync\n- **Syncing**: Being sent to OpenAI\n- **Synced**: Ready to use with AI\n- **Error**: Sync failed (check error message)\n\n## Troubleshooting\n- Large files may take longer to sync\n- Some file types may not be supported\n- Check the sync status indicator for errors', ARRAY['sync', 'status', 'upload'], 70),

('files', 'Using Files in Prompts', E'## File Search Tool\n\nWhen enabled, the AI can search through your attached files to find relevant information.\n\n## Best Practices\n- Attach reference documents for context\n- Use for RAG (Retrieval Augmented Generation)\n- Combine with specific questions about file content\n\n## Example\n"Based on the attached product documentation, what are the key features of Product X?"', ARRAY['use', 'search', 'rag'], 75);

-- Confluence
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('confluence', 'Attaching Confluence Pages', E'## Adding Confluence Pages\n\n1. Select a prompt\n2. Go to the Confluence tab\n3. Click "Add Page" to search\n4. Search by title or space\n5. Select pages to attach\n\n## What Gets Synced\n- Page title and URL\n- Full page content (converted to text)\n- Attachment metadata\n\n## Using in Prompts\nEnable Confluence tools to let the AI read and search attached pages.', ARRAY['confluence', 'attach', 'page', 'add'], 80),

('confluence', 'Confluence Search', E'## Searching Confluence\n\nUse the Confluence search modal to find pages:\n- Search by title\n- Filter by space\n- Browse recent pages\n- Preview content before attaching\n\n## In Chat\nThe AI can also search Confluence using tools:\n- search_confluence: Find pages\n- read_confluence_page: Read full content', ARRAY['confluence', 'search', 'find'], 75),

('confluence', 'Syncing Content', E'## Page Sync\n\nConfluence pages are synced to keep content fresh:\n- Manual sync via the refresh button\n- Content is converted to readable text\n- Large pages may be truncated\n\n## Sync Status\n- **Pending**: Needs to sync\n- **Synced**: Content is current\n- **Error**: Check connection/permissions', ARRAY['sync', 'update', 'refresh'], 70);

-- Cascade
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('cascade', 'Running Cascades', E'## What is a Cascade Run\n\nA cascade executes an entire prompt family in order, from top to bottom.\n\n## Execution Order\n1. Parent prompt runs first\n2. Children run in position order\n3. Each child can use {{q.parent_output}}\n4. Grandchildren follow the same pattern\n\n## Starting a Cascade\n1. Select the top-level prompt\n2. Click "Run Cascade"\n3. Watch progress in the cascade monitor\n4. Review results when complete', ARRAY['cascade', 'run', 'execute', 'all'], 85),

('cascade', 'Cascade Progress', E'## Monitoring Progress\n\nDuring a cascade run:\n- Current prompt is highlighted\n- Progress bar shows completion\n- Completed prompts show checkmarks\n- Errors are flagged immediately\n\n## Controls\n- **Pause**: Temporarily stop execution\n- **Resume**: Continue paused cascade\n- **Stop**: Cancel remaining prompts\n- **Skip**: Skip current and continue', ARRAY['progress', 'monitor', 'status'], 75),

('cascade', 'Handling Errors', E'## When Errors Occur\n\n1. Cascade pauses at the error\n2. Error message is displayed\n3. Choose to:\n   - **Retry**: Try the prompt again\n   - **Skip**: Continue without this prompt\n   - **Stop**: Cancel the cascade\n\n## Common Errors\n- Rate limiting: Wait and retry\n- Token limits: Reduce prompt size\n- API errors: Check model/settings\n- Variable errors: Check references', ARRAY['error', 'fail', 'handle', 'fix'], 80);

-- Library
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('library', 'Prompt Library', E'## What is the Prompt Library\n\nThe library stores reusable prompt content (not full prompts, just the text).\n\n## Use Cases\n- Common system prompts\n- Frequently used instructions\n- Shared prompt snippets\n- Best practice examples\n\n## Access\nClick the Library icon in the navigation rail.', ARRAY['library', 'what', 'overview'], 80),

('library', 'Saving to Library', E'## Adding to Library\n\n1. Write a prompt you want to save\n2. Click the Library icon in the prompt field\n3. Or select text and choose "Save to Library"\n4. Enter a name and category\n5. Optionally add a description\n\n## Organization\n- Use categories to group related prompts\n- Add descriptions for clarity\n- Mark as private if personal', ARRAY['save', 'add', 'create'], 75),

('library', 'Using Library Prompts', E'## Applying Library Content\n\n1. Click the Library picker in a prompt field\n2. Browse or search library items\n3. Click to preview\n4. Insert to add to your prompt\n\n## Options\n- **Replace**: Replace current content\n- **Append**: Add to end of content\n- **Link**: Reference (updates if library changes)', ARRAY['use', 'apply', 'insert'], 75);

-- Workbench
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('workbench', 'What is Workbench', E'## Workbench Overview\n\nWorkbench is a free-form AI chat space, separate from your prompts.\n\n## Use Cases\n- Explore ideas before creating prompts\n- Ask questions about Qonsol\n- Test concepts quickly\n- General AI assistance\n\n## Features\n- Multiple threads\n- File attachments\n- Confluence integration\n- Tool-enabled exploration', ARRAY['workbench', 'what', 'overview'], 80),

('workbench', 'Workbench vs Prompt Chat', E'## Key Differences\n\n| Workbench | Prompt Family Chat |\n|-----------|--------------------|\n| General purpose | Focused on prompt family |\n| Standalone threads | Context of specific prompts |\n| Own file/page attachments | Access to prompt files/pages |\n| Explore anything | Explore and run prompts |\n\n## When to Use Which\n- **Workbench**: General questions, exploration, Qonsol help\n- **Prompt Chat**: Working on specific prompt family, running prompts', ARRAY['vs', 'difference', 'compare'], 75),

('workbench', 'Workbench Tools', E'## Available Tools\n\nThe Workbench AI can:\n- List and search your prompts\n- Read prompt details\n- Execute prompts\n- Browse prompt library\n- Read attached files\n- Search Confluence pages\n- Get help about Qonsol\n\n## Example Requests\n- "Show me my recent prompts"\n- "What does the Marketing Content prompt do?"\n- "Help me understand how templates work"', ARRAY['tools', 'capabilities', 'can do'], 75);

-- Troubleshooting
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('troubleshooting', 'Common Errors', E'## Frequent Issues\n\n### "Rate limit exceeded"\nToo many API calls. Wait a moment and retry.\n\n### "Token limit exceeded"\nPrompt or response too long. Reduce content or increase max_tokens.\n\n### "Model not available"\nSelected model may be deprecated or unavailable. Try a different model.\n\n### "Variable not found"\nReferenced variable doesn''t exist. Check spelling and scope.', ARRAY['error', 'problem', 'fix', 'common'], 85),

('troubleshooting', 'Prompt Not Running', E'## If a Prompt Won''t Run\n\n1. **Check content**: Ensure system or user prompt has content\n2. **Check model**: Verify a valid model is selected\n3. **Check variables**: All required variables need values\n4. **Check API key**: Ensure OpenAI key is configured\n5. **Check exclusions**: "Exclude from cascade" might be enabled\n\n## Debug Tips\n- Look at the console for detailed errors\n- Try running a simple test prompt\n- Check the prompt settings tab', ARRAY['not running', 'stuck', 'wont run'], 80),

('troubleshooting', 'Output Issues', E'## Output Problems\n\n### Empty Output\n- Check that the prompt ran successfully\n- Model might have returned empty response\n- Check for error messages\n\n### Truncated Output\n- Increase max_tokens setting\n- Response hit the limit\n\n### Unexpected Format\n- For JSON, ensure schema is correctly defined\n- Check model capabilities for structured output', ARRAY['output', 'empty', 'wrong', 'format'], 75),

('troubleshooting', 'Sync Issues', E'## File/Confluence Sync Problems\n\n### Files Not Syncing\n- Check file size limits\n- Verify file type is supported\n- Try re-uploading\n\n### Confluence Not Loading\n- Check Confluence connection\n- Verify page permissions\n- Try manual refresh\n\n### Slow Sync\n- Large files take longer\n- Many files queued\n- Network issues', ARRAY['sync', 'file', 'confluence', 'slow'], 70),

('troubleshooting', 'Variable Resolution', E'## Variables Not Working\n\n### Shows {{variable}} in Output\nVariable wasn''t resolved. Check:\n- Variable name spelling\n- Variable has a value\n- Syntax is correct (double braces)\n\n### Wrong Value\nCheck resolution order:\n1. Direct value on prompt\n2. Inherited from parent\n3. Default value\n\n### System Variable Empty\n- {{q.parent_output}} only works if parent has run\n- Some variables need cascade context', ARRAY['variable', 'not working', 'empty'], 75);

-- Database (auto-generated style)
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority, is_auto_generated, source_type, source_id) VALUES
('database', 'Table: q_prompts', E'## q_prompts Table\n\nThe main prompts table storing all prompt configurations.\n\n### Key Columns\n| Column | Type | Description |\n|--------|------|-------------|\n| row_id | UUID | Primary key |\n| parent_row_id | UUID | Parent prompt for hierarchy |\n| prompt_name | TEXT | Display name |\n| input_admin_prompt | TEXT | System/admin prompt content |\n| input_user_prompt | TEXT | User prompt template |\n| output_response | TEXT | Last AI response |\n| model | TEXT | AI model to use |\n| node_type | TEXT | ''standard'' or ''action'' |\n| post_action | TEXT | Action type for action nodes |\n| post_action_config | JSONB | Action configuration |\n| json_schema_template_id | UUID | Link to JSON schema |\n| owner_id | UUID | Owner user ID |\n| is_private | BOOLEAN | Privacy flag |\n| is_deleted | BOOLEAN | Soft delete flag |\n| position | INTEGER | Order within parent |\n\n### Relationships\n- Self-referential: parent_row_id → row_id\n- q_assistants: linked via prompt_row_id\n- q_confluence_pages: linked via prompt_row_id\n- q_prompt_variables: linked via prompt_row_id', ARRAY['prompts', 'table', 'schema'], 70, true, 'database_schema', 'q_prompts'),

('database', 'Table: q_templates', E'## q_templates Table\n\nReusable prompt structures.\n\n### Key Columns\n| Column | Type | Description |\n|--------|------|-------------|\n| row_id | UUID | Primary key |\n| template_name | TEXT | Display name |\n| template_description | TEXT | Description |\n| structure | JSONB | Nested prompt structure |\n| variable_definitions | JSONB | Template variables |\n| category | TEXT | Organization category |\n| owner_id | UUID | Owner user ID |\n| is_private | BOOLEAN | Privacy flag |\n| version | INTEGER | Template version |', ARRAY['templates', 'table', 'schema'], 70, true, 'database_schema', 'q_templates'),

('database', 'Table: q_assistants', E'## q_assistants Table\n\nOpenAI assistant configurations linked to prompts.\n\n### Key Columns\n| Column | Type | Description |\n|--------|------|-------------|\n| row_id | UUID | Primary key |\n| prompt_row_id | UUID | Linked prompt |\n| openai_assistant_id | TEXT | OpenAI ID |\n| vector_store_id | TEXT | For file search |\n| code_interpreter_enabled | BOOLEAN | Code tool |\n| file_search_enabled | BOOLEAN | File search tool |\n| confluence_enabled | BOOLEAN | Confluence tools |\n| model_override | TEXT | Override prompt model |\n| temperature_override | TEXT | Override temperature |', ARRAY['assistants', 'table', 'schema'], 70, true, 'database_schema', 'q_assistants'),

('database', 'Table: q_json_schema_templates', E'## q_json_schema_templates Table\n\nReusable JSON schema definitions for structured output.\n\n### Key Columns\n| Column | Type | Description |\n|--------|------|-------------|\n| row_id | UUID | Primary key |\n| schema_name | TEXT | Display name |\n| schema_description | TEXT | Description |\n| json_schema | JSONB | The JSON schema |\n| system_prompt_template | TEXT | Default system prompt |\n| model_config | JSONB | Default model settings |\n| child_creation | JSONB | Child creation config |\n| action_config | JSONB | Action node config |\n| category | TEXT | Organization |', ARRAY['json', 'schema', 'table'], 70, true, 'database_schema', 'q_json_schema_templates'),

('database', 'Table: q_workbench_threads', E'## q_workbench_threads Table\n\nFree-form chat threads for the Workbench.\n\n### Key Columns\n| Column | Type | Description |\n|--------|------|-------------|\n| row_id | UUID | Primary key |\n| title | TEXT | Thread title |\n| openai_conversation_id | TEXT | OpenAI convo ID |\n| owner_id | UUID | Owner user |\n| is_active | BOOLEAN | Soft delete |\n\n### Related Tables\n- q_workbench_messages: Messages in thread\n- q_workbench_files: Attached files\n- q_workbench_confluence_links: Attached pages', ARRAY['workbench', 'threads', 'table'], 70, true, 'database_schema', 'q_workbench_threads');

-- Edge Functions
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority, is_auto_generated, source_type, source_id) VALUES
('edge_functions', 'conversation-run', E'## conversation-run Edge Function\n\nExecutes a prompt with the OpenAI Responses API.\n\n### Input\n```json\n{\n  "prompt_row_id": "uuid",\n  "variables": {},\n  "cascade_context": {}\n}\n```\n\n### Features\n- Variable substitution (user and system variables)\n- JSON schema enforcement for structured output\n- Post-action execution for action nodes\n- Tool integration (file_search, code_interpreter, web_search)\n\n### Response\nStreaming SSE with events:\n- `response.output_text.delta`: Text chunks\n- `response.completed`: Final response\n- `error`: Error details', ARRAY['conversation', 'run', 'execute', 'function'], 75, true, 'edge_function', 'conversation-run'),

('edge_functions', 'workbench-chat', E'## workbench-chat Edge Function\n\nFree-form chat for the Workbench with tools.\n\n### Input\n```json\n{\n  "message": "user message",\n  "thread_row_id": "uuid",\n  "system_prompt": "optional override",\n  "model": "optional override"\n}\n```\n\n### Available Tools\n- list_prompts: Search and list prompts\n- get_prompt_details: Full prompt info\n- execute_prompt: Run a prompt\n- list_library: Browse prompt library\n- get_library_item: Get library content\n- list_confluence: Search attached pages\n- read_confluence_page: Read page content\n- search_qonsol_help: Search knowledge base', ARRAY['workbench', 'chat', 'function'], 75, true, 'edge_function', 'workbench-chat'),

('edge_functions', 'confluence-manager', E'## confluence-manager Edge Function\n\nManages Confluence page attachments and syncing.\n\n### Actions\n\n#### search\nSearch Confluence pages by title or space.\n```json\n{"action": "search", "query": "...", "space_key": "..."}\n```\n\n#### get_page\nFetch full page content.\n```json\n{"action": "get_page", "page_id": "..."}\n```\n\n#### sync_page\nSync page content to local storage.\n```json\n{"action": "sync_page", "page_id": "...", "prompt_row_id": "..."}\n```\n\n#### delete_page\nRemove page attachment.\n```json\n{"action": "delete_page", "row_id": "..."}\n```', ARRAY['confluence', 'manager', 'function'], 70, true, 'edge_function', 'confluence-manager'),

('edge_functions', 'thread-manager', E'## thread-manager Edge Function\n\nManages OpenAI conversation threads.\n\n### Actions\n\n#### create\nCreate new thread for a prompt.\n```json\n{"action": "create", "prompt_row_id": "...", "name": "..."}\n```\n\n#### list\nList threads for a prompt.\n```json\n{"action": "list", "prompt_row_id": "..."}\n```\n\n#### delete\nSoft delete a thread.\n```json\n{"action": "delete", "thread_row_id": "..."}\n```\n\n#### update\nUpdate thread name.\n```json\n{"action": "update", "thread_row_id": "...", "name": "..."}\n```', ARRAY['thread', 'manager', 'function'], 70, true, 'edge_function', 'thread-manager'),

('edge_functions', 'openai-proxy', E'## openai-proxy Edge Function\n\nProxies requests to OpenAI API with rate limiting.\n\n### Purpose\n- Centralized API key management\n- Rate limit handling\n- Error normalization\n- Usage tracking\n\n### Input\nStandard OpenAI API request body.\n\n### Response\nProxied OpenAI response or error.', ARRAY['openai', 'proxy', 'function'], 65, true, 'edge_function', 'openai-proxy'),

('edge_functions', 'openai-billing', E'## openai-billing Edge Function\n\nTracks AI usage costs.\n\n### Input\n```json\n{\n  "model": "gpt-4o",\n  "tokens_input": 1000,\n  "tokens_output": 500,\n  "prompt_row_id": "...",\n  "response_id": "..."\n}\n```\n\n### Features\n- Calculates cost based on model pricing\n- Stores in q_ai_costs table\n- Tracks per-prompt and per-user usage\n- Supports cascade cost attribution', ARRAY['billing', 'cost', 'function'], 65, true, 'edge_function', 'openai-billing');

-- API patterns
INSERT INTO public.q_app_knowledge (topic, title, content, keywords, priority) VALUES
('api', 'Supabase Client Usage', E'## Using the Supabase Client\n\n```javascript\nimport { supabase } from "@/integrations/supabase/client";\n\n// Query data\nconst { data, error } = await supabase\n  .from(''q_prompts'')\n  .select(''*'')\n  .eq(''owner_id'', userId);\n\n// Insert data\nconst { data, error } = await supabase\n  .from(''q_prompts'')\n  .insert({ prompt_name: ''New Prompt'' })\n  .select();\n\n// Call edge function\nconst { data, error } = await supabase.functions\n  .invoke(''conversation-run'', {\n    body: { prompt_row_id: ''...'' }\n  });\n```', ARRAY['supabase', 'client', 'query', 'api'], 70),

('api', 'Common Query Patterns', E'## Frequently Used Queries\n\n### Get prompt with children\n```javascript\nconst { data } = await supabase\n  .from(''q_prompts'')\n  .select(''*, children:q_prompts!parent_row_id(*)'')\n  .eq(''row_id'', promptId);\n```\n\n### Get prompts with variables\n```javascript\nconst { data } = await supabase\n  .from(''q_prompts'')\n  .select(''*, variables:q_prompt_variables(*)'')\n  .eq(''row_id'', promptId);\n```\n\n### Search prompts by name\n```javascript\nconst { data } = await supabase\n  .from(''q_prompts'')\n  .select(''*'')\n  .ilike(''prompt_name'', `%${search}%`)\n  .eq(''is_deleted'', false);\n```', ARRAY['query', 'pattern', 'example'], 65),

('api', 'RLS and Permissions', E'## Row Level Security\n\nAll tables use RLS policies for data access:\n\n### Domain-Based Access\n```sql\ncurrent_user_has_allowed_domain()\n```\nUser email must be from allowed domains (chocfin.com, oxygn.cloud).\n\n### Owner-Based Access\n```sql\nowner_id = auth.uid()\n```\nUser owns the resource.\n\n### Admin Override\n```sql\nis_admin(auth.uid())\n```\nUser has admin role.\n\n### Shared Access\n```sql\nEXISTS (SELECT 1 FROM resource_shares ...)\n```\nResource explicitly shared with user.', ARRAY['rls', 'permission', 'security', 'access'], 70);