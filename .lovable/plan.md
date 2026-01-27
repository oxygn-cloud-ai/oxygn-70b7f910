
# Remediation Plan: Jira/Figma Integration Audit Fixes

## Executive Summary
The audit identified 4 bugs, 4 critical risks, and 5 omissions in the Jira/Figma integration. This plan addresses all findings to unblock progression.

---

## Phase 1: Critical Fixes (Blocking Issues)

### 1.1 Disable Non-Functional Jira Action
**File:** `src/config/actionTypes.ts`

The `create_jira_ticket` action returns a placeholder error but is marked as enabled, misleading users. Disable until MCP integration is complete.

**Change:** Line 379: Set `enabled: false`

---

### 1.2 Add figma-manager to config.toml
**File:** `supabase/config.toml`

The edge function is missing from config, risking deployment issues.

**Add:**
```toml
[functions.figma-manager]
verify_jwt = true
```

---

### 1.3 Implement Missing list-files Action
**File:** `supabase/functions/figma-manager/index.ts`

The `list-files` action is validated but not implemented. Two options:

**Option A (Recommended):** Remove `list-files` from valid actions since Figma API doesn't have a direct "list user files" endpoint - users paste URLs instead.

**Option B:** Implement using Figma's /me/files endpoint (requires additional API permissions).

**Recommendation:** Remove from validation since the search modal uses URL pasting, not file listing.

---

### 1.4 Fix Duplicate Validation Case
**File:** `supabase/functions/_shared/validation.ts`

Lines 446-467 have duplicate `attach-file` cases. Consolidate into single case that validates both `fileKey` and `promptRowId`.

---

## Phase 2: Deployment Verification

### 2.1 Deploy Updated Edge Function
After fixing config.toml, deploy `figma-manager`:
```
Deploy figma-manager edge function
```

### 2.2 Verify Database Tables
Confirm tables exist and RLS is working:
- `q_jira_projects`
- `q_jira_issues`
- `q_figma_files`

---

## Phase 3: UI Integration (Optional - Deferred)

These items are not blocking but represent incomplete work:

### 3.1 Add Figma to Navigation Submenu
Update `SubmenuPanel.tsx` to include Figma under Integrations section.

### 3.2 Integrate FigmaFilesSection
Add to prompt detail view alongside existing ConfluencePagesSection.

---

## Phase 4: Jira MCP Integration (Future)

When ready to enable Jira:

### 4.1 Implement MCP Connector Call
Update `createJiraTicket.ts` to call the Atlassian MCP connector's `createJiraIssue` tool instead of returning placeholder error.

### 4.2 Re-enable Action
Set `enabled: true` in `actionTypes.ts` after testing.

---

## Implementation Order

1. ✅ Disable `create_jira_ticket` action (immediate fix) - DONE
2. ✅ Add `figma-manager` to `config.toml` - DONE
3. ✅ Remove `list-files` from validation - DONE
4. ✅ Fix duplicate validation case - DONE
5. ✅ Deploy `figma-manager` - DONE
6. ✅ Database tables verified (q_jira_projects, q_jira_issues, q_figma_files exist)

---

## Technical Details

### Files to Modify

| File | Change Type | Priority |
|------|-------------|----------|
| `src/config/actionTypes.ts` | Set enabled: false | Critical |
| `supabase/config.toml` | Add function entry | Critical |
| `supabase/functions/_shared/validation.ts` | Remove list-files, fix duplicate case | Critical |
| `supabase/functions/figma-manager/index.ts` | No change if removing list-files | N/A |

### Estimated Effort
- Phase 1: ~30 minutes
- Phase 2: ~15 minutes
- Phase 3: Deferred
- Phase 4: Future sprint
