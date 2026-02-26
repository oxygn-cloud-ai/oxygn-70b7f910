

## Adversarial Implementation Audit Report

---

### Files Changed

| File | Change Type |
|---|---|
| `src/utils/oauthDetection.ts` | Created |
| `src/contexts/AuthContext.tsx` | Amended |
| `src/components/ProtectedRoute.tsx` | Amended |
| `CLAUDE.md` | Amended (documentation) |

---

### Per-File Analysis

#### 1. `src/utils/oauthDetection.ts` (New)

**Description**: Shared utility extracting OAuth callback detection logic previously inline in ProtectedRoute.

**Verification**:
- Strict TypeScript, explicit return type `boolean`. No `any`, no `@ts-nocheck`. ✅
- Detects implicit flow tokens in hash (`access_token`, `refresh_token`, `id_token`). ✅
- Detects authorization code flow params (`code`, `state`, `error`). ✅
- No side effects, pure function. ✅
- Matches plan specification exactly. ✅

**Issues**: None.

**Verification status**: ✅ Correct | **Risk level**: Low

---

#### 2. `src/contexts/AuthContext.tsx` (Amended)

**Description**: Stopped skipping `INITIAL_SESSION`; removed `getSession()` race; added safety timeout; fixed `AuthContextValue` value object completeness; imported shared `isOAuthCallbackInProgress`.

**Verification**:

- `INITIAL_SESSION` is now processed (lines 130-149). When session has a user, finalizes immediately. When null but callback in progress, keeps `loading=true`. When null with no callback, sets `loading=false`. ✅
- Standalone `getSession()` call removed. ✅
- Safety timeout at 5 seconds (lines 182-189) with cleanup (line 193). ✅
- `value` object (lines 291-308) now includes `isPlatformAdmin`, `tenantId`, `tenantName`, `tenantRole`, `tenantStatus`, `isTenantAdmin`. ✅
- Import of `isOAuthCallbackInProgress` from shared utility (line 6). ✅
- `redirect_uri` remains `${window.location.origin}/auth` (line 207). ✅
- No `// @ts-nocheck` present. ✅

**Issues identified**:

**⚠️ Warning — Login tracking regression (lines 158-164)**:
In the published-domain callback path: `INITIAL_SESSION` fires with null user (callback in progress) → `initialSessionHandledRef.current` remains `false` → `SIGNED_IN` fires with session → `isActualLogin = event === 'SIGNED_IN' && initialSessionHandledRef.current` evaluates to `false`. The `user_login_success` PostHog event is NOT tracked for Google OAuth logins on the published domain.

In the previous (broken) implementation, the `getSession()` path would set `initialSessionHandledRef.current = true` before `SIGNED_IN` fired, so login tracking worked (when session actually resolved). This is a minor analytics regression.

Severity: Low. Functional auth is unaffected. Only PostHog tracking is missed for this specific flow.

**Verification status**: ⚠️ Warning | **Risk level**: Low

---

#### 3. `src/components/ProtectedRoute.tsx` (Amended)

**Description**: Replaced inline OAuth detection with shared utility import; added 5-second timeout escape hatch.

**Verification**:

- Imports `isOAuthCallbackInProgress` from `@/utils/oauthDetection` (line 4). ✅
- Inline implementation fully removed (no duplication). ✅
- Timeout escape hatch (lines 14-21): `useEffect` sets `callbackTimedOut=true` after 5 seconds. ✅
- Cleanup: `clearTimeout` in effect cleanup. ✅
- Spinner shown while `loading || callbackInProgress` (line 25). ✅
- Redirect to `/auth` when not authenticated (line 35). ✅
- Debug log on redirect (line 34). ✅
- Empty dependency array `[]` on useEffect means timeout starts once on mount. If `isOAuthCallbackInProgress()` returns false on mount, the effect returns early and no timer is set. Correct. ✅
- `children` return type: `React.ReactNode` passed through as `{children}` — returns `ReactElement | null` per JSX. TypeScript is satisfied because function return annotation is implicit. ✅

**Issues**: None.

**Verification status**: ✅ Correct | **Risk level**: Low

---

#### 4. `CLAUDE.md` (Amended)

**Description**: Updated utility module count from 16 to 17; added `oauthDetection.ts` entry.

**Verification**:

**❌ Bug — Documentation update not persisted**: The `<last-diff>` shows changes to CLAUDE.md (lines 58 and 277 changed from 16→17, line 295 added `oauthDetection.ts` entry). However, the current file content at line 277 reads `### Utilities (\`src/utils/\`) - 16 modules` and line 295 shows `- \`logger.ts\` - Logging utilities` with no `oauthDetection.ts` entry following it. The documentation update appears to not have been applied or was reverted.

**Verification status**: ❌ Bug Found | **Risk level**: Low

---

### Bugs Found

| # | File | Location | Description |
|---|---|---|---|
| 1 | `CLAUDE.md` | Lines 58, 277, 295 | Documentation update (16→17 modules, oauthDetection.ts entry) shown in diff but not present in current file. Module count and entry are missing. |

---

### Critical Risks

None identified. The implementation correctly addresses the root cause (skipping `INITIAL_SESSION`) and introduces appropriate safety timeouts to prevent infinite spinners.

---

### Unintended Changes

None detected. All changes are within the approved scope of 3 source files + documentation.

---

### Omissions

| # | Description | Severity |
|---|---|---|
| 1 | `CLAUDE.md` not updated with `oauthDetection.ts` entry (or update lost). | Low |
| 2 | Login tracking (`user_login_success` PostHog event) regressed for published-domain Google OAuth flow due to `initialSessionHandledRef` timing change. The plan did not specify preserving this behavior, but it is an unintended side effect. | Low |

---

### Architectural Deviations

None. The implementation follows existing patterns:
- Shared utility in `src/utils/` (consistent with 16 existing utilities)
- Auth logic centralized in `AuthContext` (existing pattern)
- `ProtectedRoute` delegates to `useAuth()` context (existing pattern)
- `redirect_uri` set to `/auth` intentionally diverges from Lovable Cloud default (`window.location.origin`) — this is the documented, justified fix

---

### Summary

The implementation is **functionally correct** for its stated goal: fixing the published-domain Google OAuth login loop. The root cause (skipping `INITIAL_SESSION`) is properly addressed. Safety timeouts prevent infinite spinners. The `AuthContextValue` interface mismatch is fixed. Code duplication is eliminated via the shared utility.

Two minor issues found:
1. CLAUDE.md documentation update appears missing (cosmetic)
2. PostHog login tracking regressed for published-domain Google OAuth (analytics only, no functional impact)

**Recommendation**: Progression is **permitted**. Neither issue blocks the fix. Both can be addressed in a follow-up.

---

### Remediation Plan

**Step 1** — Fix CLAUDE.md: Update utility count to 17 and add `oauthDetection.ts` entry after `logger.ts`.

**Step 2** — Fix login tracking regression in `AuthContext.tsx`: In the non-INITIAL_SESSION handler (line 158), change the `isActualLogin` condition to also detect the case where `INITIAL_SESSION` had a null user during a callback:

```typescript
const isActualLogin = event === 'SIGNED_IN' && !initialSessionHandledRef.current
  ? true  // First SIGNED_IN after null INITIAL_SESSION = real login
  : event === 'SIGNED_IN' && initialSessionHandledRef.current;
```

Or simplified: `const isActualLogin = event === 'SIGNED_IN';` — since `SIGNED_IN` only fires on actual sign-in events (not token refreshes, which fire `TOKEN_REFRESHED`).

Both are low-priority and do not affect the OAuth fix.

