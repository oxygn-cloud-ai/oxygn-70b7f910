

# Adversarial Implementation Audit Report

## Files Changed

1. `supabase/migrations/20260211031349_a6e4b142-76e8-45d4-972a-a18313300f34.sql`
2. `supabase/functions/_shared/validation.ts`
3. `supabase/functions/credentials-manager/index.ts`
4. `supabase/functions/confluence-manager/index.ts`
5. `src/hooks/useUserCredentials.ts`
6. `src/components/settings/SystemApiKeysSection.tsx`
7. `src/components/layout/SubmenuPanel.tsx`
8. `src/pages/MainLayout.tsx`
9. `src/components/content/SettingsContent.tsx`
10. `src/components/settings/OpenAIIntegrationSettings.tsx`
11. `src/components/settings/AnthropicIntegrationSettings.tsx`
12. `src/components/settings/ManusIntegrationSettings.tsx`
13. `src/components/settings/FigmaIntegrationSettings.tsx`
14. `src/integrations/supabase/types.ts` (auto-generated, noted)

Out-of-scope files also modified (from previous message):
15. `src/components/ModelDefaultsSection.tsx`
16. `src/components/InlineModelSettings.tsx`
17. `src/components/NewPromptChoiceDialog.tsx`
18. `src/components/OwnerChangePopover.tsx`

---

## Per-File Analysis

### 1. Migration SQL
- **Changes**: Creates `system_credentials` table, RLS, `encrypt_system_credential`, `decrypt_credential_with_fallback` functions.
- **Status**: ⚠️ Warning
- **Issues**:
  - The `get_system_status` action in `credentials-manager` queries `system_credentials` using the service-role client, which bypasses RLS entirely. This is correct for the edge function context, but the RLS policies on `system_credentials` are admin-only for SELECT. If any future code uses the anon-key client to query this table, non-admin users will get empty results. This is acceptable but fragile.
  - The `decrypt_credential_with_fallback` function queries `system_credentials` without any auth check. Since it is `SECURITY DEFINER`, it bypasses RLS. This is intentional (any user should be able to USE system keys via edge function), but means any SQL caller with access to this function can decrypt system credentials. Risk is mitigated by the encryption key being a server-side secret only.
- **Risk**: Low

### 2. `_shared/validation.ts`
- **Changes**: Added `set_system`, `delete_system`, `get_system_status` to valid actions. Added validation cases for `set_system` and `delete_system`.
- **Status**: ✅ Correct
- **Risk**: Low

### 3. `credentials-manager/index.ts`
- **Changes**: Added `checkIsAdmin` helper, `set_system`, `delete_system`, `get_system_status` actions. Updated `get_decrypted` to use `decrypt_credential_with_fallback`. Enhanced `get_status` to include `systemConfigured`.
- **Status**: ⚠️ Warning
- **Issues**:
  - **Bug 1**: The `get_system_status` action queries `system_credentials` using the service-role client. However, the `get_status` action also queries `system_credentials` using the same service-role client (line 120-123). Both bypass RLS correctly. No bug here.
  - **Bug 2**: The `delete_system` action (line 341-348) deletes from `system_credentials` using the service-role client. Without a `key` parameter, it deletes ALL credentials for a service. This is intentional but the `delete_system` validation in `validation.ts` (line 166-173) makes `key` optional. A careless admin call without `key` will wipe all keys for the service. This matches the `delete` user action pattern, so it is consistent but risky.
  - **Bug 3**: The `set_system` action calls `encrypt_system_credential` RPC which also checks `is_admin` internally. This is double-checking (edge function checks + DB function checks). Not a bug, but redundant. Acceptable defense-in-depth.
- **Risk**: Low

### 4. `confluence-manager/index.ts`
- **Changes**: Lines 147 and 154 replaced `decrypt_credential` with `decrypt_credential_with_fallback`.
- **Status**: ✅ Correct
- **Risk**: Low

### 5. `useUserCredentials.ts`
- **Changes**: Full rewrite with TypeScript types. Added system credential methods.
- **Status**: ⚠️ Warning
- **Issues**:
  - **Bug 4**: The `deleteCredential` method (line 115) accepts `key: string | null = null`. When passed to `invokeCredentialsManager('delete', { service, key })`, if `key` is `null`, it sends `key: null` in the request body. The `delete` validation in `validation.ts` (line 161) uses `body.key !== undefined` to check, so `null` passes validation but the edge function (line 205) uses `if (key)` which treats `null` as falsy -- so it omits the `.eq('credential_key', key)` filter and deletes ALL keys for the service. This is the existing behavior but may surprise callers who pass `null` expecting "delete nothing specific."
  - **Bug 5**: `isSystemKeyActive` (line 186-188) reads from `systemConfiguredMap` which is populated by `getCredentialStatus` (from the `get_status` response's `systemConfigured` boolean). However, `SystemApiKeysSection` calls `getSystemCredentialStatus` which populates `systemCredentialStatus` -- a different state variable. The two state maps track different things but there is conceptual overlap. If `getCredentialStatus` is never called for a service, `isSystemKeyActive` will return `false` even if a system key exists. This means integration settings pages must call `getCredentialStatus` on mount (which they do), but `SystemApiKeysSection` calling only `getSystemCredentialStatus` does NOT populate `systemConfiguredMap`. This separation is correct by design but could confuse future developers.
  - **Bug 6**: The `useEffect` in `SystemApiKeysSection` (line 75-78) calls `getSystemCredentialStatus` for all 6 services on every render where `getSystemCredentialStatus` changes. Since `getSystemCredentialStatus` is wrapped in `useCallback` with `[invokeCredentialsManager]` dependency, and `invokeCredentialsManager` has `[]` dependency, this should be stable. However, the `useEffect` fires once and calls 6 async functions in a loop without cancellation. If the component unmounts mid-flight, React state updates on unmounted component will occur (React 18 suppresses warnings but it's still wasted work). Minor issue.
- **Risk**: Low

### 6. `SystemApiKeysSection.tsx`
- **Changes**: New admin-only component for managing system-wide credentials.
- **Status**: ⚠️ Warning
- **Issues**:
  - **Bug 7**: The component uses `bg-success/10` and `text-success` CSS classes (line 173). The Qonsol design system specifies `text-green-500` with `bg-green-500/10` for success states. If `success` is not mapped as a Tailwind color token, these classes will not render. Need to verify if `success` is a configured token.
  - **Bug 8**: The `SettingCard` component is used with a `label` prop (e.g., `label="About"`, `label={svc.label}`). This renders the subtle label text above the card content. Inside each card, there's also an `<h4>` with `svc.label` (line 154), creating a duplicate label -- the SettingCard label and the h4 text both say "OpenAI", "Anthropic", etc. This violates the design system rule against duplicate headings.
- **Risk**: Low

### 7. `SubmenuPanel.tsx`
- **Changes**: Added admin-gated "System API Keys" submenu item with `Shield` icon. Added `isAdmin` prop to `SettingsSubmenu`.
- **Status**: ⚠️ Warning
- **Issues**:
  - **Bug 9**: The `SubmenuItem` component (line 28) has untyped props: `({ icon: Icon, label, description, isActive = false, onClick })`. This is a pre-existing TypeScript issue (all params implicitly `any`). The plan stated "All new and amended files must be TypeScript with strict type safety." The `SettingsSubmenu` component (line 87) also has untyped props including the new `isAdmin` parameter. This violates the strict typing requirement.
  - The plan specified `Key` icon for the system keys submenu item, but the implementation uses `Shield` icon (line 169). This is a deviation from the plan but arguably acceptable (Shield conveys security better). Noted as plan deviation.
- **Risk**: Low

### 8. `MainLayout.tsx`
- **Changes**: Passes `isAdmin` prop to `SubmenuPanel`.
- **Status**: ✅ Correct
- **Risk**: Low

### 9. `SettingsContent.tsx`
- **Changes**: Added `SystemApiKeysWrapper` lazy import, registered in `SETTINGS_SECTIONS`, added to `getSectionProps`. Updated `GeminiSection` and `ConfluenceSection` with system key indicators.
- **Status**: ⚠️ Warning
- **Issues**:
  - **Bug 10**: `SettingsContent` (line 2431) has completely untyped props. This is pre-existing but the file was modified, and the mandate requires strict typing on all amended files.
  - **Bug 11**: The Confluence section's system key badge uses `<Key>` icon (line 2024-2025) while all other integration pages use `<ShieldCheck>`. Inconsistency in badge icon.
  - **Bug 12**: The `GeminiSection` still contains the pre-existing Eye/EyeOff toggle violation noted in Finding 8 of the plan. The plan said "not in scope" but the GeminiSection was modified in this implementation (system key logic was added). Modifying the file without fixing the known violation is a missed opportunity but not a regression.
- **Risk**: Low

### 10-13. Integration Settings (OpenAI, Anthropic, Manus, Figma)
- **Changes**: Added `isSystemKeyActive` usage, system key badge, conditional hiding of per-user inputs.
- **Status**: ✅ Correct
- **Risk**: Low

### 14. Out-of-Scope Files (ModelDefaultsSection, InlineModelSettings, NewPromptChoiceDialog, OwnerChangePopover)
- **Status**: ❌ Scope Violation
- **Issue**: These 4 files were modified in the same implementation batch but are NOT in the approved plan. They were modified to fix pre-existing TypeScript errors. While the intent was helpful, this constitutes unauthorized scope expansion.

---

## Bugs Found

1. **Bug 7** - `SystemApiKeysSection.tsx` line 173: Uses `bg-success/10` and `text-success` CSS classes. If `success` is not a configured Tailwind token, these classes produce no styling. Should use `bg-green-500/10` and `text-green-500` per design system.

2. **Bug 8** - `SystemApiKeysSection.tsx` lines 150, 154: Duplicate label -- `SettingCard label={svc.label}` renders a label AND `<h4>{svc.label}</h4>` inside the card renders the same text again. Violates design system "DO NOT add duplicate headings."

3. **Bug 9** - `SubmenuPanel.tsx` lines 28, 87: `SubmenuItem` and `SettingsSubmenu` components have untyped props (implicit `any`). The amended file does not satisfy strict TypeScript requirements.

4. **Bug 10** - `SettingsContent.tsx` line 2431: `SettingsContent` component props are entirely untyped. File was modified but strict typing not applied.

5. **Bug 11** - `SettingsContent.tsx` line 2024: Confluence system key badge uses `<Key>` icon instead of `<ShieldCheck>` used by all other integration pages. Visual inconsistency.

6. **Bug 12** - `SettingsContent.tsx` GeminiSection: Still contains Eye/EyeOff show-key toggle that violates `security/api-key-visibility-restriction` memory. File was modified but known violation was not addressed.

---

## Critical Risks

1. **Severity: Medium** - The `decrypt_credential_with_fallback` DB function has no caller authentication check. Any code with access to the encryption key and ability to call this function can decrypt any system or user credential. Mitigated by encryption key being a server-side-only secret, but a leaked key would expose all credentials. **Remediation**: This is inherent to the design and acceptable given the architecture. No action needed unless the encryption key isolation is ever weakened.

2. **Severity: Low** - The `delete_system` action without a `key` parameter deletes ALL system credentials for a service. No confirmation mechanism exists. An admin misfire could wipe all Confluence credentials (email + api_token) in one call. **Remediation**: Consider requiring `key` as mandatory for `delete_system` or adding a confirmation step in the UI.

---

## Unintended Changes

1. **4 out-of-scope files modified**: `ModelDefaultsSection.tsx`, `InlineModelSettings.tsx`, `NewPromptChoiceDialog.tsx`, `OwnerChangePopover.tsx` were modified to fix pre-existing TypeScript errors. These changes were not specified in the implementation plan.

2. **Icon deviation**: Plan specified `Key` icon for system-keys submenu item; implementation uses `Shield` icon.

---

## Omissions

1. **SubmenuPanel.tsx strict typing**: The plan stated "All new and amended files must be TypeScript with strict type safety." `SubmenuPanel.tsx` was amended but its components remain untyped.

2. **SettingsContent.tsx strict typing**: Same issue -- file was amended but the main component and numerous section components remain untyped.

3. **GeminiSection Eye/EyeOff removal**: The plan explicitly documented this as Finding 8 and noted it. Since the GeminiSection was modified in this implementation, the known security violation should have been fixed as a minimal-scope correction.

---

## Architectural Deviations

1. **Confluence badge icon inconsistency**: All other integration pages use `ShieldCheck` for the system key badge, but Confluence uses `Key`. This creates a visual inconsistency in the design system pattern.

2. **No new patterns or coupling introduced**: The implementation follows existing patterns (edge function actions, RPC calls, hook-based state management). No architectural deviations detected beyond the items above.

---

## Summary

The core implementation is functionally correct and secure. The database migration, edge function changes, credential fallback logic, and frontend integration all work as designed. The system-wide credential priority model (system first, user fallback) is properly implemented across both the `credentials-manager` path and the `confluence-manager` direct-RPC path.

**Issues requiring remediation before progression:**
- 2 design system violations (duplicate labels in SystemApiKeysSection, incorrect success color tokens)
- 1 visual inconsistency (Confluence badge icon)
- 4 unauthorized out-of-scope file modifications (acknowledged as TypeScript fixes but not in plan)
- Missing strict TypeScript typing on amended files (SubmenuPanel, SettingsContent)

**Recommendation**: Progression is **conditionally permitted** after addressing bugs 7, 8, 9, 10, and 11. The out-of-scope modifications (bug fixes) do not introduce regressions but should be acknowledged as scope expansion.

---

## Remediation Plan

### Step 1: Fix SystemApiKeysSection duplicate labels (Bug 8)
Remove the `<h4>{svc.label}</h4>` inside each SettingCard since the `label` prop already renders the service name.

### Step 2: Fix SystemApiKeysSection color tokens (Bug 7)
Replace `bg-success/10 text-success` with `bg-green-500/10 text-green-500` per design system.

### Step 3: Fix Confluence badge icon inconsistency (Bug 11)
In `SettingsContent.tsx` ConfluenceSection, replace `<Key className="h-3 w-3" />` with `<ShieldCheck className="h-3 w-3" />` in the system key badge and add `ShieldCheck` to imports.

### Step 4: Add TypeScript types to SubmenuPanel (Bug 9)
Add interfaces for `SubmenuItemProps` and `SettingsSubmenuProps` (including `isAdmin: boolean`) to `SubmenuPanel.tsx`.

### Step 5: Add TypeScript types to SettingsContent (Bug 10)
Add a `SettingsContentProps` interface to the main component in `SettingsContent.tsx`.

### Step 6: Remove GeminiSection Eye/EyeOff toggle (Bug 12)
Since GeminiSection was modified in this implementation, remove the `showKey` state, Eye/EyeOff toggle button, and change the input to always use `type="password"`. This aligns with the existing `security/api-key-visibility-restriction` memory.

### Step 7: Acknowledge out-of-scope changes
Document that `ModelDefaultsSection.tsx`, `InlineModelSettings.tsx`, `NewPromptChoiceDialog.tsx`, and `OwnerChangePopover.tsx` were modified outside the plan scope to fix pre-existing TypeScript build errors. No rollback required as changes are non-destructive.

