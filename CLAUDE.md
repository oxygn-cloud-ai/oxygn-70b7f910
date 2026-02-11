# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OXYGN is an AI orchestration platform for building, managing, and executing complex AI workflows. It provides a visual interface for prompt execution, conversation management, and cascade workflows primarily targeting OpenAI models (with Anthropic support). It includes integrations with Confluence, Figma, Jira, Manus, and PostHog.

## Development Commands

```bash
npm run dev          # Start Vite dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint with zero-warnings policy
npm run preview      # Preview production build
```

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TanStack React Query, Tailwind CSS, shadcn/ui (Radix primitives)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **State Management**: React Context API (no Redux/Zustand)
- **Routing**: React Router DOM 6
- **Rich Text**: TipTap editor (`@tiptap/*`)
- **Animations**: Framer Motion
- **Drag & Drop**: React DnD
- **Toasts**: Sonner
- **Analytics**: PostHog (`src/lib/posthog.ts`)

### Key Directory Structure
```
src/
├── assets/         # Brand images and logos
├── components/     # 14 subdirectories + ~46 root-level component files (see below)
├── config/         # 6 config files (see below)
├── contexts/       # 9 context providers (Auth, ApiCall, CascadeRun, Undo, etc.)
├── hooks/          # 54 custom hooks for business logic
├── integrations/   # Supabase client, generated types, OpenAPI schema
├── lib/            # PostHog analytics (posthog.ts), cn() utility (utils.ts)
├── pages/          # Route pages: Auth.tsx, MainLayout.tsx
├── services/       # API calls, mutations, 6 action executors
├── types/          # Type definitions (chat.ts, figma.ts, jira.ts)
└── utils/          # 16 utility modules (see below)

supabase/
├── functions/      # 26 Deno Edge Functions (see below)
└── migrations/     # ~100 SQL migrations
```

### Components Structure (`src/components/`)

14 subdirectories plus ~46 root-level component files:

| Directory | Files | Purpose |
|-----------|-------|---------|
| `admin/` | 3 | Knowledge base management (editor, import/export) |
| `chat/` | 7 | Message display, threads, thinking indicators |
| `content/` | 9 | Main content area views (Dashboard, Prompts, Settings, Health) |
| `export/` | 6+ | Export drawers, selectors, Confluence types |
| `icons/` | 1 | Custom icons (Slack) |
| `layout/` | 12 | Navigation rail, panels, search modal, top bar |
| `settings/` | 6 | Integration settings (OpenAI, Anthropic, Figma, Manus) + SystemApiKeysSection |
| `shared/` | 8 | Markdown areas, resizable areas, skeletons, TipTap utils |
| `tabs/` | 4 | Conversation, prompt fields, templates, variables tabs |
| `templates/` | 10 | Template editor, JSON schema, preview, import/export |
| `ui/` | 58 | shadcn/ui Radix primitives + custom extensions |
| `versions/` | 6 | Version history, diff viewer, commit/rollback dialogs |

Key root-level components: `ProtectedRoute`, `ErrorBoundary`, `ActionPreviewDialog`, `CascadeRunProgress`, `CascadeErrorDialog`, `NavigationGuard`, `PostHogPageView`, `VariablePicker`, `PromptField`, `PromptBox`.

### Config Files (`src/config/`)

- `actionTypes.ts` - Action type definitions (create_children_text/json/sections, create_template, create_jira_ticket, recursive_chat, call_webhook)
- `modelCapabilities.ts` - UI metadata for model settings (temperature, max_tokens, reasoning_effort, etc.)
- `contextVariables.ts` - Context variable keys (q.prompt.name, q.parent.*, q.user.*, q.today, etc.)
- `systemVariables.ts` - System variables with types (STATIC, USER_EDITABLE, INPUT, SELECT, RUNTIME)
- `labels.ts` - UI tooltip labels and copy text
- `iconCategories.ts` - Pattern categories for 1400+ Lucide icons

### Context Provider Hierarchy (App.tsx)
Deeply nested providers in this order (outer to inner):
1. ErrorBoundary (outer)
2. QueryClientProvider (React Query)
3. ToastHistoryProvider
4. UndoProvider
5. PendingSaveProvider
6. CreatePromptProvider
7. TooltipSettingsProvider
8. TooltipProvider (shadcn/Radix UI)
9. CascadeRunProvider
10. BrowserRouter (React Router)
11. ApiCallProvider
12. LiveApiDashboardProvider
13. AuthProvider
14. ErrorBoundary (inner)

Non-provider components also nested within: `PostHogPageView`, `NavigationGuard`, `Routes`, `ProtectedRoute`.

### Routing Structure
- `/auth` → `Auth.tsx` (public)
- `/*` → `ProtectedRoute` wrapping `MainLayout.tsx` (authenticated)
- Internal navigation within MainLayout uses `activeNav` state (not nested routes)
- Views: prompts, templates, settings, health, admin

### Core Patterns

**Data Flow**: React Query for server state, Context for UI state. All data fetching goes through hooks that wrap Supabase queries.

**Prompt Execution**: The cascade execution system (`useCascadeExecutor`, `CascadeRunContext`) handles multi-step prompt workflows with variable resolution and action execution.

**Real-time Updates**: Supabase Realtime subscriptions + SSE streaming for long-running operations. Webhook handlers (`openai-webhook`, `manus-webhook`) process async completions.

**Variable System**: Variables resolved via `variableResolver.ts` and `resolveSystemVariables.ts`. Context variables defined in `config/contextVariables.ts`.

**Version History**: Full prompt version control system with commit, diff, rollback, and preview capabilities (`prompt-versions` edge function, `usePromptVersions` hook, `versions/` components).

**Knowledge Base**: Admin-facing knowledge management with embedding generation (`batch-embeddings`, `generate-embedding` edge functions) and CRUD via `KnowledgeManager`/`KnowledgeEditor` components.

**Credential Hierarchy**: Multi-tier credential system where admin-set system credentials (`system_credentials` table) take priority over user-provided credentials (`user_credentials`). The `decrypt_credential_with_fallback()` DB function checks system keys first, then falls back to user keys. Managed via `credentials-manager` edge function, `useUserCredentials` hook, and `SystemApiKeysSection` admin UI.

**Action Executors** (`src/services/actionExecutors/`): 6 action types that run after prompt execution:
- `createChildrenText` / `createChildrenJson` / `createChildrenSections` - Create child prompts
- `createTemplate` - Generate templates from output
- `createJiraTicket` - Create Jira issues
- `processVariableAssignments` - Assign output to variables

### Services (`src/services/`)

- `promptService.ts` - Prompt operations orchestration
- `promptQueries.ts` - Query functions for prompts
- `promptMutations.ts` - Mutation functions for prompts
- `promptDeletion.ts` - Prompt deletion logic
- `templateService.ts` - Template configuration and application
- `errorHandling.ts` - Error handling utilities
- `actionExecutors/` - 6 action executor modules + index

### Utilities (`src/utils/`) - 16 modules

- `variableResolver.ts` - Variable resolution engine
- `resolveSystemVariables.ts` - System variable resolution
- `sseStreamParser.ts` - SSE streaming response parser
- `tokenizer.ts` - Token counting
- `lexPosition.ts` - Fractional indexing for list ordering
- `costEstimator.ts` - Cost calculation logic
- `jsonSchemaValidator.ts` - JSON schema validation
- `actionValidation.ts` - Action configuration validation
- `schemaUtils.ts` - Schema manipulation utilities
- `positionUtils.ts` - Position/tree utilities
- `namingTemplates.ts` - Template naming utilities
- `recentVarRefs.ts` - Recent variable references tracking
- `apiErrorUtils.ts` - API error handling
- `retryUtils.ts` - Retry logic for operations
- `safeEnv.ts` - Safe environment variable access
- `logger.ts` - Logging utilities

### Database Tables (q_ prefix)
- `q_prompts` - Prompt definitions with hierarchical structure
- `q_assistants` - Conversation/Assistant records
- `q_threads` - Conversation threads (with `purpose` column for chat vs run track separation)
- `q_templates` - Reusable templates
- `q_models` / `q_model_pricing` - Model configurations and costs
- `q_prompt_variables` - Variable bindings
- `q_ai_costs` - AI execution cost tracking
- `q_pending_responses` - Long-running OpenAI responses awaiting webhooks
- `q_app_knowledge` - Knowledge base content
- `q_jira_projects` / `q_jira_issues` - Jira integration
- `q_figma_files` - Figma integration
- `system_credentials` - Admin-managed, workspace-wide API keys (encrypted, RLS admin-only)
- `profiles` - User profiles
- `projects` - Project records

### Edge Functions (26 total)

All require JWT except where noted:

**Core Execution:**
- `openai-proxy` - Proxies OpenAI API calls with model resolution
- `conversation-run` - Executes conversations
- `conversation-cancel` - Cancels in-progress OpenAI Responses API requests
- `studio-chat` - Studio chat interface (supports OpenAI & Anthropic)
- `prompt-family-chat` - Interactive chat for prompt families
- `execution-manager` - Manages execution traces and spans with rate limiting

**Webhooks (no JWT):**
- `openai-webhook` - Receives OpenAI async completions
- `manus-webhook` - Manus task updates
- `prompt-versions` - Version control for prompts (commit, rollback, history)

**Resource Management:**
- `conversation-manager` - Manages assistants, files, vector stores, file_search
- `thread-manager` - Manages conversation threads and family threads
- `credentials-manager` - Encrypted credential storage for all providers (OpenAI, Anthropic, Confluence, Manus, Figma, Gemini); supports both user and system (admin) credentials with fallback hierarchy
- `resource-health` - Monitors health of files and resources

**Knowledge & Embeddings:**
- `batch-embeddings` - Batch embedding generation for knowledge base
- `generate-embedding` - Single embedding generation

**Integrations:**
- `confluence-manager` - Confluence pages, spaces, sync, templates (v1 & v2 API)
- `figma-manager` - Figma file attachment, sync, metadata
- `manus-task-create` - Creates tasks in Manus
- `manus-webhook-register` - Registers Manus webhook endpoints

**Validation & Billing:**
- `anthropic-key-validate` - Validates Anthropic API keys
- `manus-key-validate` - Validates Manus API keys
- `openai-billing` - Fetches OpenAI billing information
- `fetch-provider-models` - Fetches available models from providers

**Utilities:**
- `github-release` - GitHub release management
- `test-openai-delete` - Test function for OpenAI DELETE API
- `_shared/` - Shared utility modules used across functions

### Integrations

- **Confluence**: Export, page sync, search (`confluence-manager` edge function, `useConfluenceExport`/`useConfluencePages` hooks, `ConfluenceSearchModal`/`ConfluencePagesSection` components)
- **Figma**: File attachments, sync, metadata (`figma-manager` edge function, `useFigmaFiles` hook, `FigmaIntegrationSettings`/`FigmaSearchModal`/`FigmaFilesSection` components)
- **Jira**: Ticket creation action (`createJiraTicket` action executor, `q_jira_projects`/`q_jira_issues` tables)
- **Manus**: Task creation, webhook subscriptions (`manus-task-create`, `manus-webhook-register` edge functions, `useManusTaskSubscription` hook, `ManusIntegrationSettings` component)
- **PostHog**: Analytics tracking (`src/lib/posthog.ts`, `PostHogPageView` component, error tracking in `ErrorBoundary`)

### Path Aliases
- `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)
- `lib` maps to `./lib` (in vite.config.ts)

## Environment Variables

Uses `VITE_` prefixed environment variables for:
- Supabase URL and anon key
- PostHog API key and host
- Database table name overrides (e.g., `VITE_PROMPTS_TBL="q_prompts"`)

No `.env.example` exists — refer to `.env` for required variables.

## Important Considerations

- Uses fractional indexing (`lexPosition.ts`) for ordering items in lists
- SSE parsing handled by `sseStreamParser.ts` for streaming responses
- Cost tracking per execution stored in `q_ai_costs`
- Multi-tenant with Row-Level Security on all tables
- Lovable AI is used for development with automatic Git commits (lovable-tagger plugin in vite.config.ts)
- Both `npm` (package-lock.json) and `bun` (bun.lockb) lock files exist
- Thread `purpose` column separates "chat" vs "run" tracks
- Action/communication node type exclusivity enforced by database constraints
- TypeScript strict mode enabled with no unused variables/parameters
- Credentials encrypted at rest via `pgp_sym_encrypt`; frontend only sees status flags, never raw keys
- System credentials (admin-managed) override user credentials via DB fallback functions
