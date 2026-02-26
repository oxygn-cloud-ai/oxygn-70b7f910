# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OXYGN is an AI orchestration platform for building, managing, and executing complex AI workflows. It provides a visual interface for prompt execution, conversation management, and cascade workflows primarily targeting OpenAI models (with Anthropic support). It includes integrations with Confluence, Figma, Jira, Manus, and PostHog. The product name is **Qonsol** (visible in browser title), built by **Oxygn**.

## Development Commands

```bash
npm run dev          # Start Vite dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint with zero-warnings policy
npm run preview      # Preview production build
```

**Testing**: No test infrastructure exists (no Jest, Vitest, test files, or test scripts). There are zero tests in the codebase.

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TanStack React Query, Tailwind CSS, shadcn/ui (Radix primitives)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Authentication**: Lovable Cloud OAuth (`@lovable.dev/cloud-auth-js`) wrapping Supabase Auth
- **State Management**: React Context API (no Redux/Zustand)
- **Routing**: React Router DOM 6
- **Rich Text**: TipTap editor (`@tiptap/*`)
- **Animations**: Framer Motion
- **Drag & Drop**: React DnD
- **Toasts**: Sonner
- **Analytics**: PostHog (`src/lib/posthog.ts`)

### Tailwind Customization

- **Custom colors**: `chocolate` palette (ruby, espresso, dark, milk), Material Design 3 tokens (surface, on-surface, outline, secondary-container, tertiary)
- **Font**: Poppins (loaded from Google Fonts, weights 300-700) for sans, serif, and mono
- **Custom animations**: shimmer, pulse-soft, attention-flash, accordion-down/up
- **Custom shadows**: warm, warm-lg, ruby-glow
- **Plugins**: `tailwindcss-animate`, `@tailwindcss/typography`
- **Dark mode**: Class-based
- **Border radius**: M3 shape scale (xs, m3-sm through m3-full)

### Key Directory Structure
```
src/
├── assets/         # Brand images and logos
├── components/     # 14 subdirectories + ~46 root-level component files (see below)
├── config/         # 6 config files (see below)
├── contexts/       # 9 context providers (Auth, ApiCall, CascadeRun, Undo, etc.)
├── hooks/          # 54 custom hooks for business logic
├── integrations/   # Supabase client, Lovable OAuth shim, generated types, OpenAPI schema
├── lib/            # PostHog analytics (posthog.ts), cn() utility (utils.ts)
├── pages/          # Route pages: Auth.tsx, MainLayout.tsx
├── services/       # API calls, mutations, 6 action executors
├── types/          # Type definitions (chat.ts, figma.ts, jira.ts)
└── utils/          # 17 utility modules (see below)

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
- `/~oauth/*` → blank `<div />` (public) — absorbs Lovable OAuth callback redirects so `ProtectedRoute` never intercepts them
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

**Prompt Family Chat** (`usePromptFamilyChat`, `usePromptFamilyThreads`): Per-family chat persistence with client-side caching:
- In-memory cache (max 20 families) stores threads + messages for instant restoration when switching prompts
- Cache-first display with silent background sync prevents loading flickers
- Cache invalidated on mutations (create/delete thread, clear messages)
- Thread management via `usePromptFamilyThreads`: `fetchThreads()`, `createThread()`, `switchThread()`, `deleteThread()`, `fetchMessagesQuietly()` (background refresh), `restoreThreads()` (cache restore)
- Race condition prevention: `switchRequestIdRef` invalidates stale async operations, `activeThreadIdRef` provides synchronous reads
- Auto-selects most recent thread on family load if no thread is active

### Cascade Execution State Machine

The cascade executor (`useCascadeExecutor.ts` + `CascadeRunContext.tsx`) is the most complex subsystem:

**State transitions:**
```
idle → startCascade() → isRunning
isRunning → pause() → isPaused
isPaused → resume() → isRunning
isRunning → cancel() → isCancelling → idle
isRunning → completeCascade() → idle
```

**Ref-based flags**: Uses `cancelRef` and `pauseRef` instead of useState for synchronous cancellation/pause checks within the executor loop (avoids re-render delays).

**Promise-based dialog resolution**: Error, action preview, and question dialogs resolve via promises stored in refs:
- `showError()` → `Promise<'retry'|'skip'|'stop'>`
- `showActionPreview()` → `Promise<boolean>`
- `showQuestion()` → `Promise<string|null>`

**Variable resolution hierarchy** (later overwrites earlier):
1. System variables (`q.today`, `q.user.name`, `q.parent.prompt.name`)
2. Cascade variables (`cascade_previous_response`, `cascade_all_responses`)
3. Q.ref variables (`q.ref[UUID].output_response`) — from already-executed prompts
4. User-defined variables (prompt-specific)

Note: `q.parent.prompt.name` uses the IMMEDIATE parent, not the top-level root.

**Retry logic**: Max 3 retries for transient errors. Rate limit waits (max 12 per prompt, ~60s total) are counted separately and don't increment `retryCount`.

**Cancel handler registration**: Executor registers a `cancelFn` via `registerCancelHandler()` that can abort OpenAI requests and clean up Manus tasks before UI reflects cancellation.

**Manus task execution**: Creates task via edge function, then sets up Realtime subscription + 2s polling interval with 30-minute timeout. Waits for: completed | failed | cancelled | requires_input.

**Background polling for long_running prompts**: Both `executeCascade()` (top-level loop) and `executeChildCascade()` handle `long_running` interrupts from GPT-5 models via `waitForBackgroundResponse()`. When a prompt returns `interruptType === 'long_running'`, a toast is shown ("Background processing: ...") and execution blocks until the background response arrives. On success, `output_response` and `user_prompt_result` are updated in the DB and the cascade continues normally. `waitForBackgroundResponse()` uses a hybrid Realtime + polling strategy (mirroring `runManusTask` pattern):
1. Realtime subscription on `q_pending_responses` for instant updates
2. Database polling fallback (10-second intervals) to catch missed realtime events
3. Edge function polling (`poll-openai-response`) as tertiary fallback
4. Cancellation checks every 1 second
5. 10-minute timeout with automatic cleanup of all timers/subscriptions

This ensures all cascade levels block until actual AI responses complete rather than returning prematurely, with robust handling of realtime delivery failures. Background wait results never include usage/token data (unlike streaming results). `poll-openai-response` also acts as a synthetic webhook: if it detects terminal status but the DB record is still pending (webhook missed), it updates `q_pending_responses` directly, with `reasoning_text` extracted separately for extended thinking models.

**Action node handling**: Extract JSON from response → validate against schema → show preview dialog (unless `skip_preview`) → execute post-action → if `auto_run_children`:
1. Wrap recursive cascade in `startCascade()`/`completeCascade()` lifecycle hooks
2. Fetch children ordered by `position_lex` (not `position`)
3. DB fallback if `actionResult.children` array is empty despite `createdCount > 0`
4. Success toast only fires for successful prompt executions (not errors)
5. Recursively execute child cascade with proper depth tracking

### SSE Streaming Details

**Parser** (`sseStreamParser.ts`): Line-by-line buffer parsing with incomplete line carryover between chunks.

**Event types handled**: `api_started`, `thinking_started/delta/done`, `output_text_delta`, `usage_delta`, `complete`, `user_input_required`, `long_running_started`, `error`

**Dashboard integration** (`LiveApiDashboardContext`):
- Output text debounced at 120ms (prevents excessive re-renders from streaming deltas)
- Token increments batched at 200ms (enables streaming speed calculation)
- Cumulative stats tracked only for cascade calls

**True cancellation flow**: Capture `response_id` → abort client stream (`AbortController`) → call `conversation-cancel` edge function → update UI state. This order prevents race conditions.

**Question node resume**: If result has `interruptType === 'question'`, loops: show question dialog → call `runConversation()` with `resumeResponseId` + answer → repeat if still interrupted.

**Webhook post-action pipeline** (`MainLayout.tsx`): When GPT-5 models complete via webhook (`usePendingResponseSubscription`), action nodes automatically execute their post-actions:
1. Fetch completed prompt data from database
2. Extract JSON from webhook output via `extractJsonFromResponse()`
3. Store `extracted_variables` in `q_prompts` table
4. Validate response against `post_action_config` schema
5. Execute post-action via `executePostAction()` (shows preview dialog unless `skip_preview`)
6. Process variable assignments if configured via `processVariableAssignments()`
7. Auto-run created children if `auto_run_children` enabled (recursive cascade)
8. Update `last_action_result` with status, message, and metadata
9. Refresh tree data and expand parent folders
This ensures action nodes work identically whether executed synchronously (streaming) or asynchronously (webhook delivery).

### Realtime Configuration

Only **two tables** are published for Supabase Realtime (both with `REPLICA IDENTITY FULL`):
- `q_manus_tasks`
- `q_pending_responses`

Do NOT expect realtime subscriptions on `q_prompts`, `q_threads`, or other tables.

### Tree / Save / Undo Patterns

**Tree operations** (`useTreeOperations.ts`): Add, delete (soft via `is_deleted: true`), move, duplicate, batch ops. All follow the pattern: mutate → `refreshTreeData()` → toast with undo.

**Prompt data** (`usePromptData.ts`): Fetches prompt with joined assistant. For child prompts, walks up tree to find root prompt's assistant (all prompts in a family share the root's assistant for file storage).

**Field-level undo** (`useFieldUndo.ts`): Per-field stack (max 10 entries), scoped to `entityId`. Resets when switching prompts, preserves stack when same prompt saves.

**Selection persistence**: `selectedPromptId` and `expandedFolders` stored in localStorage with `qonsol-*` keys.

### Layout State

All panel states persisted to localStorage:
- `qonsol-folder-panel-open`, `qonsol-nav-rail-open`, `qonsol-reading-pane-open`, `qonsol-conversation-panel-open`
- `qonsol-active-nav` (default: 'prompts')
- `qonsol-selected-prompt-id`, `qonsol-expanded-folders`
- `handleResetLayout()` clears all `qonsol-panel-layout` keys and resets panels to defaults

### Keyboard Shortcuts

| Shortcut | Action | Works While Typing |
|----------|--------|-------------------|
| Cmd/Ctrl+B | Toggle folder panel | Yes |
| Cmd/Ctrl+J | Toggle conversation panel | Yes |
| Cmd/Ctrl+S | Save current item | Yes |
| Cmd/Ctrl+Enter | Run prompt | No |
| Escape | Close modals/panels | No |
| Cmd/Ctrl+Z | Undo last action | Yes |

Typing detection checks: `INPUT`, `TEXTAREA`, `SELECT` elements and `isContentEditable`.

### Services (`src/services/`)

- `promptService.ts` - Prompt operations orchestration
- `promptQueries.ts` - Query functions for prompts
- `promptMutations.ts` - Mutation functions for prompts
- `promptDeletion.ts` - Prompt deletion logic
- `templateService.ts` - Template configuration and application
- `errorHandling.ts` - Error handling utilities
- `actionExecutors/` - 6 action executor modules + index

### Utilities (`src/utils/`) - 17 modules

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
- `oauthDetection.ts` - Shared `isOAuthCallbackInProgress()` utility (detects implicit and authorization code OAuth flows from URL hash/params)

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

### Database Functions & Triggers (28 total)

**RLS helpers** (used in ~90% of policies):
- `current_user_has_allowed_domain()` - Domain whitelist check (hardcoded: `chocfin.com`, `oxygn.cloud`). Adding a new domain requires a migration.
- `is_admin(user_id)` - Admin role lookup via `user_roles` table
- `owns_prompt(user_id, prompt_id)` - Recursive ancestor chain ownership check
- `can_read_resource()` / `can_edit_resource()` - Explicit resource share lookup
- `can_version_prompt()` - Version creation permission (admin or owner + resource_shares with 'edit')

**Prompt family triggers**:
- `compute_root_prompt_row_id()` - TRIGGER: walks parent chain with cycle detection (max 20 hops). Never update `root_prompt_row_id` manually.
- `increment_family_version()` - TRIGGER: bumps root prompt's `family_version` on structural changes (used for cache invalidation)
- `mark_prompt_uncommitted()` - TRIGGER: tracks 65+ specific fields for change detection. New fields require trigger update for auto-detection.

**Version history**:
- `create_prompt_version()` - Creates JSONB snapshot with `fields_changed` tracking and locking
- `rollback_prompt_version()` - Auto-creates backup before rollback
- `build_prompt_snapshot()` - Builds complete state (44 fields across 4 parts to avoid 100-arg limit)
- `calculate_changed_fields()` - Diffs snapshots to track what changed
- `cleanup_old_prompt_versions(max_age_days=90, min_versions_to_keep=10)` - Admin-only retention

**Credentials & encryption**:
- `encrypt_credential()` / `encrypt_system_credential()` - PGP symmetric encryption
- `decrypt_credential()` / `decrypt_credential_with_fallback()` - Decryption with system-first fallback

**Validation triggers**:
- `enforce_prompt_action_invariants()` - Validates `post_action` config based on `node_type`
- `validate_response_format()` - Ensures valid JSON Schema for `response_format`

**Cleanup functions** (all manual, no pg_cron configured):
- `cleanup_orphaned_manus_tasks()` - Marks pending tasks failed after 2 hours
- `cleanup_orphaned_pending_responses()` - Marks pending responses failed after 2 hours
- `cleanup_old_pending_responses()` - Deletes completed responses after 30 days
- `cleanup_old_rate_limits()` / `cleanup_orphaned_traces()` - Data retention

**User management**:
- `handle_new_user()` - TRIGGER on auth user creation to backfill profiles
- `set_thread_owner()` / `set_assistant_owner()` - TRIGGER: auto-set owner_id on insert
- `get_user_email(user_id)` - Fetch email from profiles

### RLS Policy Patterns

~332 RLS policies across all tables. Common patterns:

**Pattern 1 — Domain-gated** (~90% of tables): `USING (current_user_has_allowed_domain())`. If user's email domain changes, they lose access silently.

**Pattern 2 — Owner + Admin**: `USING (owner_id = auth.uid() OR is_admin(auth.uid()))`

**Pattern 3 — Admin-only**: `USING (is_admin(auth.uid()))` — for delete policies, system credentials, cleanup functions.

**Pattern 4 — Shared resources**: Checks `resource_shares` table for explicit read/edit grants.

**Pattern 5 — View security**: `prompt_owner_emails` view uses `WITH (security_invoker = true)` to inherit RLS from underlying tables.

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
- `openai-webhook` - Receives OpenAI async completions; idempotent via `webhook_event_id` (safe to retry)
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
- `poll-openai-response` - Polls OpenAI for background response status; extracts `output_text` and `reasoning_text` (extended thinking); updates `q_pending_responses` directly if webhook failed to deliver (synthetic webhook fallback)
- `_shared/` - Shared utility modules used across functions

### Edge Function Developer Guide

When adding a new edge function, follow these patterns from `_shared/`:

**CORS** (`_shared/cors.ts`): Centralized CORS handler with whitelisted origins (`qonsol.app`, `www.qonsol.app`, `*.lovable.app` previews, `localhost:8080/5173/3000`). No wildcard `*`. Always import `getCorsHeaders` and `handleCorsOptions` — never hardcode CORS headers.

**Authentication**: Use `SUPABASE_ANON_KEY` with the request's auth header for RLS enforcement. Use `SUPABASE_SERVICE_ROLE_KEY` ONLY for operations that need to bypass RLS (webhook processing, internal cleanup).

**Credentials** (`_shared/credentials.ts`): User API keys are fetched via inter-function call to `credentials-manager` (never from env vars). Available helpers: `getOpenAIApiKey()`, `getAnthropicApiKey()`, `getManusApiKey()`, `getGeminiApiKey()`, `getFigmaAccessToken()`. 5-second timeout — returns `null` on failure (no fallback to env vars).

**Validation** (`_shared/validation.ts`): Lightweight runtime checks (no Zod, for faster cold starts). Provides `isValidUUID()`, `isNonEmptyString()`, `isPositiveInteger()`, `isObject()`, and action-specific validators like `validateThreadManagerInput()`, `validateOpenAIProxyInput()`, etc.

**Error codes** (`_shared/errorCodes.ts`): Standardized error system with HTTP status, recoverable flag, and user message. Use `buildErrorResponse(ERROR_CODES.OPENAI_NOT_CONFIGURED)` and `getHttpStatus()`. Categories: Auth, API Keys, Validation, Rate Limiting, Timeouts, Provider-specific.

**Tables** (`_shared/tables.ts`): Always reference tables via `TABLES.*` constants (e.g., `TABLES.PROMPTS`, `TABLES.AI_COSTS`). Never hardcode table names — they're overridable via env vars.

**Models** (`_shared/models.ts`): Models configured in database, not hardcoded. Use `resolveApiModelId()` to map user-friendly names to API model IDs. `fetchModelConfig()` returns capabilities, token param name, pricing, and provider details.

**Webhook signatures**: OpenAI uses Standard Webhooks (HMAC-SHA256) via `webhook-id`/`webhook-timestamp`/`webhook-signature` headers. Manus uses RSA signature verification via `X-Webhook-Signature`/`X-Webhook-Timestamp` headers with public key fetched from Manus API (cached 1 hour). Both verify timestamp within 5 minutes.

**Streaming responses**: Use `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Include CORS headers in streaming responses.

**Long-running detection**: GPT-5 models are routed to webhook mode (creates `q_pending_responses` record) to avoid edge function timeout (10 min limit).

### Anthropic Integration

The `_shared/anthropic.ts` module handles OpenAI-to-Anthropic format conversion:
- `max_tokens` is **required** for Anthropic (unlike OpenAI which has defaults)
- System message extracted to top-level `system` parameter
- Stateless — full message history required with each request
- Stream events have different structure — use `parseAnthropicStreamEvent()` adapter

### Authentication Flow

Google OAuth sign-in uses Lovable Cloud as an intermediary layer (`src/integrations/lovable/index.ts`):
1. Frontend calls `lovable.auth.signInWithOAuth("google", options)`
2. Lovable Cloud OAuth flow handles provider authentication
3. Tokens returned to client
4. Client calls `supabase.auth.setSession(tokens)` to establish Supabase session
5. AuthContext manages session state and user profile

This pattern allows centralized OAuth management through Lovable while maintaining Supabase as the auth backend. The `lovable/index.ts` shim is auto-generated and should not be manually modified.

**`ProtectedRoute` OAuth guard**: Before redirecting unauthenticated users to `/auth`, `ProtectedRoute` checks for in-progress OAuth callbacks via `isOAuthCallbackInProgress()`. This detects both implicit flow (hash contains `access_token`, `refresh_token`, or `id_token`) and authorization code flow (query params contain `code`, `state`, or `error`). If either is detected, it renders a loading spinner and waits — preventing a premature redirect that would discard the OAuth tokens.

**`AuthContext` initial session race prevention**: `onAuthStateChange` skips `INITIAL_SESSION` events entirely. Initial auth state is loaded exclusively via `getSession()`, after which `initialSessionHandledRef` is set to `true`. Subsequent `SIGNED_IN` events are then treated as real logins (and trigger login tracking). This prevents a race where `INITIAL_SESSION` fires with a null user before `getSession()` resolves, causing a spurious redirect to `/auth`. The Google OAuth redirect URI points to `window.location.origin` (the site root, not `/auth`).

**OAuth error surfacing**: `AuthContext` mounts a `useEffect` that inspects `window.location.hash` on load. If the hash contains `error=`, it parses the error and `error_description` fields, displays a toast to the user, and strips the error fragment from the URL via `window.history.replaceState`. This surfaces upstream OAuth failures (e.g., provider-side rejections) that arrive as hash fragments.

### Integrations

- **Lovable Cloud**: OAuth provider wrapper for Google/Apple sign-in (`@lovable.dev/cloud-auth-js` package, `src/integrations/lovable/index.ts` shim)
- **Confluence**: Export, page sync, search (`confluence-manager` edge function, `useConfluenceExport`/`useConfluencePages` hooks, `ConfluenceSearchModal`/`ConfluencePagesSection` components)
- **Figma**: File attachments, sync, metadata (`figma-manager` edge function, `useFigmaFiles` hook, `FigmaIntegrationSettings`/`FigmaSearchModal`/`FigmaFilesSection` components)
- **Jira**: Ticket creation action (`createJiraTicket` action executor, `q_jira_projects`/`q_jira_issues` tables)
- **Manus**: Task creation, webhook subscriptions (`manus-task-create`, `manus-webhook-register` edge functions, `useManusTaskSubscription` hook, `ManusIntegrationSettings` component)
- **PostHog**: Analytics tracking (`src/lib/posthog.ts`, `PostHogPageView` component, error tracking in `ErrorBoundary`)

### Path Aliases
- `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)
- `lib` maps to `./lib` (in vite.config.ts)

## CI/CD

`.github/workflows/auto-release.yml` — triggers on push to `main` branch (Lovable sync) and manual `workflow_dispatch`. Creates GitHub releases tagged `v-<short-sha>` with auto-generated release notes using `softprops/action-gh-release@v2`.

## Environment Variables

Uses `VITE_` prefixed environment variables for:
- Supabase URL and anon key
- PostHog API key and host
- Database table name overrides (e.g., `VITE_PROMPTS_TBL="q_prompts"`)

No `.env.example` exists — refer to `.env` for required variables.

Edge functions use:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CREDENTIALS_ENCRYPTION_KEY` (used only by `credentials-manager`)
- `OPENAI_WEBHOOK_SECRET` (optional, for webhook signature verification)

## Build & Tooling Configuration

- **shadcn/ui** (`components.json`): Style `default`, base color `slate`, RSC disabled, `tsx: false` (shadcn components use `.jsx`/`.js` extensions despite TypeScript elsewhere)
- **ESLint** (`.eslintrc.cjs`): Extends `eslint:recommended`, `plugin:react/recommended`, `plugin:react-hooks/recommended`. React-refresh plugin enabled. `react/prop-types` disabled (TypeScript used instead). Zero warnings enforced (`--max-warnings 0`).
- **TypeScript** (`tsconfig.json`): Target ES2020, strict mode, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all enabled.
- **Vite** (`vite.config.ts`): Port 8080, React plugin + `lovable-tagger` in dev mode, React/ReactDOM deduplication, CommonJS mixed modules support.

## Important Considerations

- Uses fractional indexing (`lexPosition.ts`) for ordering items in lists
- SSE parsing handled by `sseStreamParser.ts` for streaming responses
- Cost tracking per execution stored in `q_ai_costs`
- Multi-tenant with Row-Level Security on all tables (see RLS Policy Patterns above)
- Lovable AI is used for development with automatic Git commits (lovable-tagger plugin in vite.config.ts)
- Both `npm` (package-lock.json) and `bun` (bun.lockb) lock files exist
- Thread `purpose` column separates "chat" vs "run" tracks
- Action/communication node type exclusivity enforced by database constraints
- TypeScript strict mode enabled with no unused variables/parameters
- Credentials encrypted at rest via `pgp_sym_encrypt`; frontend only sees status flags, never raw keys
- System credentials (admin-managed) override user credentials via DB fallback functions
- No `pg_cron` configured — all cleanup functions (orphaned tasks, old versions, pending responses) are manual/admin-triggered. Without periodic calls, data accumulates indefinitely.
- Prompt family hierarchy max depth is 20 hops (cycle detection trigger). `root_prompt_row_id` is auto-computed — never update manually.
- `mark_prompt_uncommitted` trigger watches 65+ fields. Adding new prompt fields requires updating the trigger for auto-detection.
- Version numbers are per-prompt (V1, V2, V3...). Deleting versions does not renumber them.
- Only `q_manus_tasks` and `q_pending_responses` have Realtime enabled. Other tables do not support realtime subscriptions.
- Domain whitelist for RLS is hardcoded (`chocfin.com`, `oxygn.cloud`). Adding new domains requires a SQL migration.
