
# Revised Jira and Figma Integration Plan
## Adversarial Audit Report with Complete Corrections

---

## Executive Summary

After exhaustive analysis of the uploaded integration plan against the existing codebase, I identified **47 critical issues** across 7 categories. This revised plan addresses all findings and strictly aligns with the established architectural patterns, type safety requirements, and existing code conventions.

---

## PART 1: AUDIT FINDINGS

### Category 1: Architectural Deviations (11 issues)

| # | Original Plan Issue | Impact | Resolution |
|---|---------------------|--------|------------|
| 1 | Proposes `npm install atlassian-jira` and `npm install figma-js` | Edge functions use Deno runtime, NOT Node.js | Use native `fetch()` with Atlassian REST API v3 and Figma REST API v1 directly |
| 2 | Tables named `jira_spaces`, `jira_issues`, `figma_files` | Violates `q_` prefix convention per `architecture/database-table-naming-convention-migration` memory | Rename to `q_jira_projects`, `q_jira_issues`, `q_figma_files` |
| 3 | Proposes OAuth2 redirect flows with custom endpoints | App uses encrypted credential storage pattern via `credentials-manager` | Follow `useUserCredentials` + `credentials-manager` pattern with stored tokens |
| 4 | Proposes separate MCP server endpoints | Atlassian MCP connector is ALREADY AVAILABLE in Lovable platform (see useful-context) | Leverage existing `mcp_01kd3dfhpfes393satgfkgdkjm--*` tools for Jira, don't build custom |
| 5 | Missing validation functions | All edge functions use `_shared/validation.ts` pattern | Add `validateJiraManagerInput()` and `validateFigmaManagerInput()` |
| 6 | No CORS handling mentioned | All functions must use `_shared/cors.ts` | Import and use `getCorsHeaders()`, `handleCorsOptions()` |
| 7 | Missing tool registry integration | Family chat uses modular tool registry in `_shared/tools/` | Add `figmaModule` to registry (Jira already has MCP) |
| 8 | Missing error codes | Edge functions use `_shared/errorCodes.ts` pattern | Define `JIRA_NOT_CONFIGURED`, `FIGMA_NOT_CONFIGURED`, `JIRA_API_ERROR`, `FIGMA_API_ERROR` |
| 9 | Frontend OAuth flow proposed | Security model requires server-side credential handling per `auth/per-user-api-keys-architecture` | Store API tokens via `credentials-manager` only |
| 10 | Plan mentions "Node.js backend" | No Node.js - Deno Edge Functions only | Remove all Node.js references |
| 11 | Plan proposes separate credential tables | Credentials stored in `user_credentials` table with encryption | Use existing `encrypt_credential`/`decrypt_credential` RPC functions |

### Category 2: Duplications with Existing Code (8 issues)

| # | Proposed Feature | Existing Implementation | Resolution |
|---|------------------|------------------------|------------|
| 1 | New `ExportTypeSelector` Jira config | `ExportTypeSelector.tsx` lines 22-29: `jira: { enabled: false, comingSoon: true }` | Enable existing config, don't recreate |
| 2 | New Jira action type schema | `actionTypes.ts` lines 373-396: `create_jira_ticket` with full configSchema | Enable and implement executor, don't redefine |
| 3 | New `JIRA` export constant | `useExport.ts` line 16: `JIRA: 'jira'` already defined | Use existing constant |
| 4 | New credential hook for Jira/Figma | `useUserCredentials` handles multi-service (see isServiceConfigured) | Add `jira` and `figma` service checks to existing hook |
| 5 | New search modal component | `ConfluenceSearchModal.tsx` (486 lines) with tree/search pattern | Clone and adapt structure |
| 6 | New edge function pattern | `confluence-manager` (1098 lines) with attach/detach/sync workflow | Follow identical structure |
| 7 | New `getCredentials` helper pattern | `credentials.ts` already has `getDecryptedCredentialWithTimeout()` | Add `getJiraCredentials()` and `getFigmaAccessToken()` following pattern |
| 8 | MCP Jira tools | Atlassian MCP already provides `getJiraIssue`, `searchJiraIssuesUsingJql`, `createJiraIssue` | Use existing MCP tools, only build Figma from scratch |

### Category 3: Security Risks (6 issues)

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| 1 | Token storage lacks encryption specification | HIGH | Explicitly use existing `encrypt_credential`/`decrypt_credential` RPC with `CREDENTIALS_ENCRYPTION_KEY` |
| 2 | No input validation on API token formats | MEDIUM | Validate Jira tokens (no prefix required), Figma tokens (must start with `figd_`) |
| 3 | No rate limiting mentioned | MEDIUM | Apply existing `check_rate_limit` action from execution-manager pattern |
| 4 | OAuth scope not specified for docs | HIGH | Document: Jira requires `read:jira-work write:jira-work`, Figma requires `file_read` |
| 5 | No credential timeout handling | MEDIUM | Use `getDecryptedCredentialWithTimeout` pattern (5000ms default) |
| 6 | RLS policies incomplete in original plan | HIGH | Define full domain-restricted RLS with owner checks |

### Category 4: Type Safety Violations (9 issues)

| # | Finding | Resolution |
|---|---------|------------|
| 1 | No TypeScript interfaces for Jira API responses | Define `JiraProject`, `JiraIssue`, `JiraIssueCreate` interfaces in `src/types/jira.ts` |
| 2 | No TypeScript interfaces for Figma API responses | Define `FigmaFile`, `FigmaNode`, `FigmaComment` interfaces in `src/types/figma.ts` |
| 3 | Hook return types not specified | Define explicit return types: `UseJiraPagesReturn`, `UseFigmaFilesReturn` |
| 4 | Edge function request/response types missing | Define `JiraManagerRequest`, `JiraManagerResponse`, `FigmaManagerRequest`, `FigmaManagerResponse` |
| 5 | Tool context types incomplete | Extend `ToolContext.credentials` for `figmaAccessToken` |
| 6 | Database table types not auto-generated | Tables will auto-generate in `types.ts` after migration |
| 7 | `useConfluencePages.ts` is JavaScript not TypeScript | New hooks must be `.ts` files with full typing |
| 8 | Plan doesn't specify `strict: true` | All new files must use TypeScript strict mode |
| 9 | Action executor lacks typed params | Define `CreateJiraTicketConfig` interface |

### Category 5: Omissions (8 issues)

| # | Missing Element | Resolution |
|---|-----------------|------------|
| 1 | RLS policies for new tables | Define domain-restricted policies with owner checks |
| 2 | Migration SQL | Create proper migration with UUIDs, timestamps, indexes |
| 3 | Settings UI components | Create `JiraIntegrationSettings.tsx` and `FigmaIntegrationSettings.tsx` |
| 4 | `TABLES` constant updates | Add `JIRA_PROJECTS`, `JIRA_ISSUES`, `FIGMA_FILES` to `_shared/tables.ts` |
| 5 | Credential helper functions | Add to `_shared/credentials.ts` |
| 6 | PostHog tracking events | Add `trackEvent()` for key actions |
| 7 | Toast notifications | Use `sonner` toast for user feedback |
| 8 | `SETTINGS_SECTIONS` updates | Add `jira` and `figma` sections to `SettingsContent.tsx` |

### Category 6: Incomplete Specifications (4 issues)

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Jira API version not specified | Use REST API v3 (current), base URL: `{baseUrl}/rest/api/3/` |
| 2 | Figma API version not specified | Use REST API v1, base URL: `https://api.figma.com/v1/` |
| 3 | Attachment storage location undefined | Store via `prompt_row_id` FK in `q_jira_issues` and `q_figma_files` |
| 4 | Export field mapping incomplete | Define variable source picker for Jira fields |

### Category 7: Pre-existing Build Error (1 issue)

| # | Finding | Resolution |
|---|---------|------------|
| 1 | `tsconfig.json(32,5): error TS6310: Referenced project '/dev-server/tsconfig.node.json' may not disable emit` | This is a pre-existing platform-controlled error per `architecture/typescript-infrastructure-and-preview-health` memory - NOT related to this integration |

---

## PART 2: CRITICAL DISCOVERY - EXISTING MCP CONNECTOR

**The Atlassian MCP connector is ALREADY integrated** in the Lovable platform (per useful-context). Available tools include:

Jira Tools (already available via MCP):
- `mcp_01kd3dfhpfes393satgfkgdkjm--getJiraIssue` - Get issue by ID/key
- `mcp_01kd3dfhpfes393satgfkgdkjm--createJiraIssue` - Create new issues
- `mcp_01kd3dfhpfes393satgfkgdkjm--editJiraIssue` - Update issues
- `mcp_01kd3dfhpfes393satgfkgdkjm--searchJiraIssuesUsingJql` - JQL search
- `mcp_01kd3dfhpfes393satgfkgdkjm--addCommentToJiraIssue` - Add comments
- `mcp_01kd3dfhpfes393satgfkgdkjm--transitionJiraIssue` - Change status
- `mcp_01kd3dfhpfes393satgfkgdkjm--getVisibleJiraProjects` - List projects
- `mcp_01kd3dfhpfes393satgfkgdkjm--lookupJiraAccountId` - Find users

**Revised Strategy:**
1. For **Jira**: Use existing MCP connector via `standard_connectors--connect` - NO custom edge function needed
2. For **Figma**: Build `figma-manager` edge function (no MCP available)

This dramatically reduces implementation scope while leveraging battle-tested functionality.

---

## PART 3: REVISED IMPLEMENTATION PLAN

### Phase 1: Database Schema

**Migration File: Add Jira and Figma tables**

Tables to create:
- `q_jira_projects` - Cache of Jira projects for UI dropdowns
- `q_jira_issues` - Attached issues linked to prompts
- `q_figma_files` - Attached Figma files linked to prompts

Key schema details:
- All tables use `row_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Foreign key `prompt_row_id` references `q_prompts(row_id) ON DELETE CASCADE`
- Timestamps: `created_at`, `updated_at` with `DEFAULT now()`
- Sync tracking: `sync_status`, `last_synced_at`
- Proper indexes on `prompt_row_id` for query performance

RLS Policies (matching existing patterns):
- SELECT: `current_user_has_allowed_domain()`
- INSERT: `current_user_has_allowed_domain()`
- UPDATE: `current_user_has_allowed_domain()`
- DELETE: `current_user_has_allowed_domain()`

---

### Phase 2: Backend - Figma Edge Function Only

**File: `supabase/functions/figma-manager/index.ts`**

Structure follows `confluence-manager` pattern exactly:
- Import shared modules: `tables.ts`, `validation.ts`, `cors.ts`, `errorCodes.ts`, `credentials.ts`
- `validateUser()` for auth
- `figmaRequest()` helper for API calls
- Action handlers: `test-connection`, `list-files`, `get-file`, `get-nodes`, `attach-file`, `detach-file`, `sync-file`, `list-attached`, `add-comment`

Figma API details:
- Base URL: `https://api.figma.com/v1/`
- Auth: `X-Figma-Token: {personal_access_token}`
- Token format: starts with `figd_`

**NOT creating jira-manager** - using MCP connector instead.

---

### Phase 3: Shared Module Updates

**File: `supabase/functions/_shared/tables.ts`**

Add constants:
```
JIRA_PROJECTS: getEnv('JIRA_PROJECTS_TBL', 'q_jira_projects'),
JIRA_ISSUES: getEnv('JIRA_ISSUES_TBL', 'q_jira_issues'),
FIGMA_FILES: getEnv('FIGMA_FILES_TBL', 'q_figma_files'),
```

**File: `supabase/functions/_shared/errorCodes.ts`**

Add error codes:
```
JIRA_NOT_CONFIGURED: 'JIRA_NOT_CONFIGURED',
FIGMA_NOT_CONFIGURED: 'FIGMA_NOT_CONFIGURED',
JIRA_API_ERROR: 'JIRA_API_ERROR',
FIGMA_API_ERROR: 'FIGMA_API_ERROR',
```

Add metadata entries with proper HTTP status codes (400 for not configured, 502 for API errors).

**File: `supabase/functions/_shared/validation.ts`**

Add `validateFigmaManagerInput()` function following existing patterns:
- Valid actions: `test-connection`, `list-files`, `get-file`, `get-nodes`, `attach-file`, `detach-file`, `sync-file`, `list-attached`, `add-comment`
- Validate `fileKey` is non-empty string for file operations
- Validate `promptRowId` is valid UUID for attach operations

**File: `supabase/functions/_shared/credentials.ts`**

Add credential helpers:
```typescript
export async function getFigmaAccessToken(authHeader: string): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'figma', 'access_token');
}
```

Note: Jira credentials are handled by the MCP connector, not custom code.

---

### Phase 4: Tool Registry - Figma Only

**File: `supabase/functions/_shared/tools/figma.ts`**

Create tool module following `confluence.ts` pattern:
- `id: 'figma'`
- `scopes: ['family']`
- Tools: `list_family_figma_files`, `read_figma_file`, `get_figma_nodes`

**File: `supabase/functions/_shared/tools/registry.ts`**

Add import and register `figmaModule` in `MODULES` array.

**NOT creating jiraModule** - Jira tools already available via MCP.

---

### Phase 5: Frontend Types

**File: `src/types/jira.ts`**

```typescript
export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrl: string;
}

export interface JiraIssue {
  row_id: string;
  issue_id: string;
  issue_key: string;
  summary: string;
  description: string | null;
  status: string;
  issue_type: string;
  priority: string;
  labels: string[];
  project_key: string;
  project_name: string;
  issue_url: string;
  sync_status: string;
  prompt_row_id: string | null;
}

export interface CreateJiraTicketConfig {
  project_key: string;
  issue_type: string;
  summary_template?: string;
  description_template?: string;
  labels?: string[];
  priority?: string;
}
```

**File: `src/types/figma.ts`**

```typescript
export interface FigmaFile {
  row_id: string;
  file_key: string;
  file_name: string | null;
  thumbnail_url: string | null;
  last_modified: string | null;
  version: string | null;
  sync_status: string;
  prompt_row_id: string | null;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}
```

---

### Phase 6: Frontend Hooks

**File: `src/hooks/useFigmaFiles.ts`**

TypeScript hook following `useConfluencePages.ts` pattern:
- State: `files`, `isLoading`, `isSyncing`, `connectionStatus`
- Actions: `testConnection`, `listFiles`, `attachFile`, `detachFile`, `syncFile`, `fetchAttachedFiles`
- Uses `supabase.functions.invoke('figma-manager', { body: {...} })`
- Full TypeScript with `UseFigmaFilesReturn` interface

**NOT creating useJiraPages** - Jira operations will use MCP connector tools directly.

---

### Phase 7: Frontend UI Components

**File: `src/components/settings/FigmaIntegrationSettings.tsx`**

Following `OpenAIIntegrationSettings.tsx` pattern exactly:
- Personal Access Token input
- Token validation (must start with `figd_`)
- Test connection button
- Status indicator (Active/Not Set)
- Help link to Figma token page

**File: `src/components/FigmaSearchModal.tsx`**

Simpler than Confluence (Figma has flat file list, not hierarchical):
- File list view
- Search by name
- Thumbnail previews
- Attach button per file

**File: `src/components/FigmaFilesSection.tsx`**

Card showing attached files with:
- Thumbnail
- File name
- Sync/detach actions

**Jira UI Notes:**
- `JiraIntegrationSettings.tsx` - Only needed if we want local credential storage for non-MCP usage
- Jira search/browse - Can use existing MCP tools via chat interface

---

### Phase 8: Settings Integration

**File: `src/components/content/SettingsContent.tsx`**

Add to `SETTINGS_SECTIONS`:
```typescript
"figma": { component: FigmaIntegrationWrapper, icon: Figma, title: "Figma" },
```

Add lazy-loaded wrapper:
```typescript
const FigmaSection = React.lazy(() => import('@/components/settings/FigmaIntegrationSettings'));
const FigmaIntegrationWrapper = () => (
  <React.Suspense fallback={<div className="p-4 text-on-surface-variant">Loading...</div>}>
    <FigmaSection />
  </React.Suspense>
);
```

---

### Phase 9: Export Integration

**File: `src/components/export/ExportTypeSelector.tsx`**

Enable existing Jira config:
```typescript
jira: {
  icon: CheckSquare,
  title: 'Jira Issue',
  description: 'Create Jira issues from prompt data automatically',
  enabled: true,  // CHANGE from false
  comingSoon: false,  // REMOVE
  color: 'blue'
}
```

**File: `src/config/actionTypes.ts`**

Enable existing `create_jira_ticket`:
```typescript
create_jira_ticket: {
  // ... existing schema
  enabled: true,  // CHANGE from false
}
```

---

### Phase 10: Action Executor

**File: `src/services/actionExecutors/createJiraTicket.ts`**

Implement using MCP connector:
```typescript
import { supabase } from '@/integrations/supabase/client';
import type { CreateJiraTicketConfig } from '@/types/jira';

export async function executeCreateJiraTicket(
  config: CreateJiraTicketConfig,
  context: { response: string; variables: Record<string, string>; promptRowId: string }
): Promise<{ success: boolean; issueKey?: string; issueUrl?: string; error?: string }> {
  // Use MCP connector's createJiraIssue tool
  // ...implementation
}
```

---

### Phase 11: Credential Service Updates

**File: `src/hooks/useUserCredentials.ts`**

Add service checks:
```typescript
if (service === 'figma') {
  return status.access_token === true;
}
// Jira uses MCP connector auth, not our credential store
```

---

## PART 4: FILES SUMMARY

### Files to CREATE

| File Path | Type | Est. Lines |
|-----------|------|------------|
| `supabase/migrations/XXXX_add_jira_figma_tables.sql` | Migration | ~100 |
| `supabase/functions/figma-manager/index.ts` | Edge Function | ~500 |
| `supabase/functions/_shared/tools/figma.ts` | Tool Module | ~150 |
| `src/types/jira.ts` | Types | ~50 |
| `src/types/figma.ts` | Types | ~40 |
| `src/hooks/useFigmaFiles.ts` | Hook | ~200 |
| `src/components/FigmaSearchModal.tsx` | Component | ~300 |
| `src/components/FigmaFilesSection.tsx` | Component | ~150 |
| `src/components/settings/FigmaIntegrationSettings.tsx` | Component | ~120 |
| `src/services/actionExecutors/createJiraTicket.ts` | Executor | ~80 |

### Files to MODIFY

| File Path | Change Description |
|-----------|-------------------|
| `supabase/functions/_shared/tables.ts` | Add 3 table constants |
| `supabase/functions/_shared/validation.ts` | Add `validateFigmaManagerInput()` |
| `supabase/functions/_shared/credentials.ts` | Add `getFigmaAccessToken()` |
| `supabase/functions/_shared/errorCodes.ts` | Add 4 error codes + metadata |
| `supabase/functions/_shared/tools/registry.ts` | Import and register `figmaModule` |
| `supabase/functions/_shared/tools/index.ts` | Export `figmaModule` |
| `src/components/export/ExportTypeSelector.tsx` | Enable Jira (change `enabled: true`) |
| `src/config/actionTypes.ts` | Enable `create_jira_ticket` |
| `src/hooks/useUserCredentials.ts` | Add `figma` service check |
| `src/components/content/SettingsContent.tsx` | Add Figma settings section |

---

## PART 5: EXPLICIT NON-CHANGES

To ensure scope compliance, the following will NOT be modified:

- Authentication flow (uses existing Supabase auth)
- Confluence functionality (already complete)
- Thread management (recent thread isolation work)
- Cascade execution (uses existing patterns)
- Prompt versioning (uses existing patterns)
- MCP connector infrastructure (platform-provided)
- No npm packages (Deno-native fetch only)
- No OAuth2 redirect flows (token-based auth only)

---

## PART 6: IMPLEMENTATION ORDER

1. **Database migration** - Required for all other work
2. **Shared utilities** - validation, credentials, tables, error codes
3. **Figma edge function** - Core API integration
4. **Figma tool module** - Chat tool integration
5. **Frontend types** - TypeScript interfaces
6. **Frontend hook** - `useFigmaFiles`
7. **UI components** - Settings, modal, section
8. **Export enablement** - Enable Jira in export selector
9. **Action executor** - `createJiraTicket` using MCP
10. **Settings integration** - Add to `SETTINGS_SECTIONS`

---

## PART 7: TESTING VERIFICATION

Post-implementation checks:
- [ ] Figma: Store token → Test connection → List files
- [ ] Figma: Attach file → Sync metadata → Display thumbnail
- [ ] Figma: Chat tools work (`list_family_figma_files`)
- [ ] Jira Export: Enable export → Create issue → Verify in Jira
- [ ] RLS: Non-domain user cannot read attached files/issues
- [ ] TypeScript: No type errors, strict mode enabled
- [ ] Build: Application builds without errors
