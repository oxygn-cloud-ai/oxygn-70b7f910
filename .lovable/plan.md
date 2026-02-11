

# System-Wide API Keys -- Revised Plan (Audit & Correction)

## Audit Findings from Previous Plan

### Finding 1: Confluence credential retrieval bypasses `credentials-manager`
`confluence-manager/index.ts` (lines 147-159) calls `decrypt_credential` RPC directly with `p_user_id`, NOT through the `getDecryptedCredential` helper or `credentials-manager` edge function. The previous plan claimed "no changes needed in 20+ edge functions" -- this is **wrong** for Confluence. The system-credential fallback must also be added to:
- The `decrypt_credential` DB function itself, OR
- The `confluence-manager` must be refactored to use `getDecryptedCredential`, OR
- A new `decrypt_system_or_user_credential` DB function must be created that both paths call.

**Chosen fix**: Create a single new DB function `decrypt_credential_with_fallback` that checks `system_credentials` first, then `user_credentials`. Update `credentials-manager`'s `get_decrypted` action and `confluence-manager`'s direct RPC calls to use this new function. This eliminates the split path.

### Finding 2: Confluence has a `base_url` stored in `q_settings`, not in `user_credentials`
Confluence's base URL is stored in the shared `q_settings` table (`confluence_base_url`), not per-user. This is already effectively "system-wide". The system credentials feature should only cover `email` and `api_token` for Confluence. The UI must not show a base_url field in the system credentials section -- it already exists in the Confluence section.

### Finding 3: Figma credential key is `access_token`, not `api_key`
The previous plan generically says "same pattern" for all services. Figma uses `access_token` as its credential_key, not `api_key`. The system credential UI and `get_status` logic must account for this per-service key naming.

### Finding 4: `Gemini` uses `getDecryptedCredential` directly, not a dedicated helper
`fetch-provider-models/index.ts` line 136 calls `getDecryptedCredential(authHeader, 'gemini', 'api_key')` directly rather than a `getGeminiApiKey` helper. The `getGeminiApiKey` helper in `credentials.ts` does exist but is unused in this function. Both paths go through `credentials-manager` so the fallback will work, but this inconsistency should be noted (not fixed in this scope).

### Finding 5: Validation whitelist must be updated
`validateCredentialsManagerInput` in `_shared/validation.ts` (line 116) has a hardcoded list of valid actions: `['get_status', 'set', 'delete', 'list_services', 'get_decrypted']`. The new actions (`set_system`, `delete_system`, `get_system_status`) must be added to this whitelist or the edge function will reject them with a 400 error.

### Finding 6: Missing admin check in `credentials-manager`
The current `credentials-manager` does not have any admin-checking infrastructure. It validates the user but never calls `is_admin`. The new system actions must add this check. Since `credentials-manager` uses the service-role client, it can call `is_admin` via RPC.

### Finding 7: `useUserCredentials` hook lacks TypeScript types
The existing hook (provided in context) uses untyped `useState({})`, `useState([])`, and untyped callback parameters throughout. The plan said "add methods" but the entire hook needs proper TypeScript interfaces to satisfy strict type safety requirements.

### Finding 8: `GeminiSection` has a show/hide key toggle (Eye/EyeOff)
Line 2343-2351 of `SettingsContent.tsx` shows the Gemini section uses `showKey` state with Eye/EyeOff toggle on the input. This violates the existing memory `security/api-key-visibility-restriction` which states "All visibility toggle buttons (Eye/EyeOff icons) and 'show key' logic have been removed." This is a pre-existing bug -- **not in scope** for this change, but noted.

### Finding 9: `decrypt_system_credential` security model
The previous plan said "checks is_admin or allowed domain user" for decryption. This is correct for the fallback function (any authenticated user should be able to USE a system credential via the edge function, but never see it). However, the RLS on `system_credentials` table must be admin-only for direct table access. The decrypt function should be `SECURITY DEFINER` and callable by any authenticated user from the edge function context (since it runs with service-role key).

### Finding 10: No `Confluence` helper in `_shared/credentials.ts`
Unlike OpenAI/Anthropic/Gemini/Manus/Figma, there is no `getConfluenceCredentials` helper. The `confluence-manager` does its own decryption inline. For consistency, the plan should add `getConfluenceCredentials` to `credentials.ts` -- but this would require refactoring `confluence-manager` which is out of scope. Instead, the `confluence-manager` direct RPC calls must switch to the new `decrypt_credential_with_fallback` function.

### Finding 11: `SubmenuPanel.tsx` needs a new entry for system keys
The previous plan says "Add System API Keys admin section in SETTINGS_SECTIONS" but omits that `SubmenuPanel.tsx` must also get a new `SubmenuItem` for the admin section. Without this, there is no way to navigate to it.

### Finding 12: Existing build errors must not be worsened
The build errors listed are in `InlineModelSettings.tsx`, `ModelDefaultsSection.tsx`, and `NewPromptChoiceDialog.tsx`. These are pre-existing and unrelated to this change. The plan must not touch these files.

---

## Revised Plan

### 1. Database Migration

**New table: `system_credentials`**

```sql
CREATE TABLE public.system_credentials (
  row_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  credential_key text NOT NULL,
  credential_value bytea NOT NULL,
  set_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (service_type, credential_key)
);

ALTER TABLE public.system_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select system credentials"
  ON public.system_credentials FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert system credentials"
  ON public.system_credentials FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update system credentials"
  ON public.system_credentials FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete system credentials"
  ON public.system_credentials FOR DELETE
  USING (public.is_admin(auth.uid()));
```

**New DB function: `encrypt_system_credential`**

```sql
CREATE OR REPLACE FUNCTION public.encrypt_system_credential(
  p_service text,
  p_key text,
  p_value text,
  p_encryption_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.system_credentials (
    row_id, service_type, credential_key,
    credential_value, set_by, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_service, p_key,
    extensions.pgp_sym_encrypt(p_value, p_encryption_key),
    auth.uid(), now(), now()
  )
  ON CONFLICT (service_type, credential_key)
  DO UPDATE SET
    credential_value = extensions.pgp_sym_encrypt(p_value, p_encryption_key),
    set_by = auth.uid(),
    updated_at = now();
END;
$$;
```

**New DB function: `decrypt_credential_with_fallback`**

This is the core change. It checks `system_credentials` first, then `user_credentials`. Both `credentials-manager` and `confluence-manager` will use this.

```sql
CREATE OR REPLACE FUNCTION public.decrypt_credential_with_fallback(
  p_user_id uuid,
  p_service text,
  p_key text,
  p_encryption_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_encrypted bytea;
BEGIN
  -- Priority 1: Check system_credentials
  SELECT credential_value::bytea INTO v_encrypted
  FROM public.system_credentials
  WHERE service_type = p_service
    AND credential_key = p_key;

  IF v_encrypted IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(v_encrypted, p_encryption_key);
  END IF;

  -- Priority 2: Fall back to user_credentials
  SELECT credential_value::bytea INTO v_encrypted
  FROM public.user_credentials
  WHERE user_id = p_user_id
    AND service_type = p_service
    AND credential_key = p_key;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN extensions.pgp_sym_decrypt(v_encrypted, p_encryption_key);
END;
$$;
```

The existing `decrypt_credential` function is left unchanged (no breaking changes to anything that still uses it).

---

### 2. Edge Function: `credentials-manager/index.ts`

**Changes:**

a. **`get_decrypted` action** (line 241-287): Replace `decrypt_credential` RPC call with `decrypt_credential_with_fallback`. This is the single change that makes all services (OpenAI, Anthropic, Gemini, Manus, Figma) that go through `getDecryptedCredential` helper automatically pick up system keys.

b. **`get_status` action** (line 93-148): Also query `system_credentials` table for the service. Return an additional `systemConfigured` boolean alongside the existing per-user `status` object. This tells the frontend whether a system key exists.

c. **Add `set_system` action**: Admin-only. Calls `encrypt_system_credential` RPC. Requires admin check via `is_admin` RPC before proceeding.

d. **Add `delete_system` action**: Admin-only. Deletes from `system_credentials` table. Requires admin check.

e. **Add `get_system_status` action**: Any authenticated user. Queries `system_credentials` for the given service and returns boolean flags (same pattern as `get_status` but for system credentials).

**Admin check pattern** (used in `set_system` and `delete_system`):
```typescript
const { data: adminCheck } = await supabase.rpc('is_admin', {
  _user_id: userId
});
if (!adminCheck) {
  return new Response(
    JSON.stringify({ error: 'Admin access required' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

### 3. Validation: `_shared/validation.ts`

Update `validateCredentialsManagerInput` (line 116):
```typescript
const validActions = [
  'get_status', 'set', 'delete', 'list_services', 'get_decrypted',
  'set_system', 'delete_system', 'get_system_status'
];
```

Add validation cases for the new actions (same pattern as existing `set`/`delete`/`get_status` -- require `service`, optionally `key`/`value`).

---

### 4. Edge Function: `confluence-manager/index.ts`

**Lines 147-159**: Replace both `decrypt_credential` RPC calls with `decrypt_credential_with_fallback`:

```typescript
const { data: emailResult } = await supabase.rpc(
  'decrypt_credential_with_fallback',
  { p_user_id: userId, p_service: 'confluence',
    p_key: 'email', p_encryption_key: encryptionKey }
);

const { data: tokenResult } = await supabase.rpc(
  'decrypt_credential_with_fallback',
  { p_user_id: userId, p_service: 'confluence',
    p_key: 'api_token', p_encryption_key: encryptionKey }
);
```

This is the minimal change needed. No other refactoring of confluence-manager.

---

### 5. Frontend Hook: `useUserCredentials.ts`

Full rewrite with strict TypeScript types:

**New interfaces:**
```typescript
interface CredentialStatusMap {
  [service: string]: Record<string, boolean>;
}

interface SystemStatusResult {
  status: Record<string, boolean>;
  systemConfigured: boolean;
}
```

**New methods added:**
- `getSystemCredentialStatus(service: string): Promise<Record<string, boolean>>` -- calls `get_system_status`
- `setSystemCredential(service: string, key: string, value: string): Promise<boolean>` -- calls `set_system`
- `deleteSystemCredential(service: string, key?: string): Promise<boolean>` -- calls `delete_system`
- `systemCredentialStatus: Record<string, Record<string, boolean>>` -- state for system key status

**Amended methods:**
- `getCredentialStatus` now also returns `systemConfigured` boolean from the enhanced `get_status` response
- `isServiceConfigured` updated to return `true` if either system OR user key exists

All parameters and return types explicitly typed. No `any`.

---

### 6. Frontend: `SubmenuPanel.tsx`

Add a new `SubmenuItem` for "System API Keys" with the `Key` icon, positioned after "Figma" and before "Appearance". Only rendered when `isAdmin` is true. This requires:
- Passing `isAdmin` prop to `SettingsSubmenu`
- Adding a guard: `{isAdmin && <SubmenuItem ... />}`
- New submenu key: `"system-keys"`

---

### 7. Frontend: `SettingsContent.tsx`

**New section component: `SystemApiKeysSection`**

Admin-only component that shows all services with system-level key management. Layout:
- One `SettingCard` per service group (OpenAI, Anthropic, Gemini, Manus, Figma, Confluence)
- Each shows: configured status, password input for setting, delete icon button
- Confluence shows two fields (email + api_token), all others show one (api_key or access_token)
- Uses `useUserCredentials` hook's new system methods
- Uses `useAuth` for `isAdmin` guard (redirect/empty state if non-admin somehow reaches it)

**Add to `SETTINGS_SECTIONS`:**
```typescript
"system-keys": {
  component: SystemApiKeysSection,
  icon: Key,
  title: "System API Keys",
},
```

**Add to `getSectionProps`:**
```typescript
case 'system-keys':
  return {};
```

---

### 8. Frontend: Integration Settings Components

For each of these 5 files + 2 inline sections, add a "System key active" indicator when a system key is configured. Changes are identical in pattern:

| File | Service | Credential Key |
|------|---------|---------------|
| `OpenAIIntegrationSettings.tsx` | openai | api_key |
| `AnthropicIntegrationSettings.tsx` | anthropic | api_key |
| `ManusIntegrationSettings.tsx` | manus | api_key |
| `FigmaIntegrationSettings.tsx` | figma | access_token |
| `SettingsContent.tsx` (GeminiSection) | gemini | api_key |
| `SettingsContent.tsx` (ConfluenceSection) | confluence | email + api_token |

**Pattern for each:**
1. Call `getCredentialStatus(service)` on mount (already done)
2. Read `systemConfigured` from the enhanced response
3. When `systemConfigured === true`:
   - Show a "System key is active" badge in the Connection card
   - Hide the per-user key input and save/delete buttons
   - Show read-only text: "A system-wide key is configured by your administrator"
4. When `systemConfigured === false`:
   - No change to existing behavior

---

### 9. `_shared/credentials.ts` -- No Changes

The helper functions (`getOpenAIApiKey`, etc.) call `getDecryptedCredential` which calls `credentials-manager` `get_decrypted`. Since `get_decrypted` now uses `decrypt_credential_with_fallback`, these helpers automatically pick up system keys. No changes needed here.

---

## Files Changed Summary

| File | Change Type | Description |
|------|------------|-------------|
| Migration SQL | New | `system_credentials` table, RLS, `encrypt_system_credential`, `decrypt_credential_with_fallback` functions |
| `supabase/functions/_shared/validation.ts` | Amend | Add 3 new actions to credentials manager validation whitelist |
| `supabase/functions/credentials-manager/index.ts` | Amend | Switch `get_decrypted` to use fallback function; enhance `get_status` to include system status; add `set_system`, `delete_system`, `get_system_status` actions; add admin check |
| `supabase/functions/confluence-manager/index.ts` | Amend | Replace 2x `decrypt_credential` RPC calls with `decrypt_credential_with_fallback` (lines 147, 154) |
| `src/hooks/useUserCredentials.ts` | Amend | Add strict TypeScript types; add system credential methods; update `isServiceConfigured` to include system keys |
| `src/components/layout/SubmenuPanel.tsx` | Amend | Add admin-gated "System API Keys" submenu item; pass `isAdmin` prop |
| `src/components/content/SettingsContent.tsx` | Amend | Add `SystemApiKeysSection` component; add to `SETTINGS_SECTIONS`; add to `getSectionProps`; update `GeminiSection` and `ConfluenceSection` to show system key status |
| `src/components/settings/OpenAIIntegrationSettings.tsx` | Amend | Add system key active indicator; hide per-user input when system key active |
| `src/components/settings/AnthropicIntegrationSettings.tsx` | Amend | Same pattern |
| `src/components/settings/ManusIntegrationSettings.tsx` | Amend | Same pattern |
| `src/components/settings/FigmaIntegrationSettings.tsx` | Amend | Same pattern |

## Files NOT Changed

- `supabase/functions/_shared/credentials.ts` -- no changes needed (flows through credentials-manager)
- `supabase/config.toml` -- auto-managed, never edited
- `src/integrations/supabase/types.ts` -- auto-generated
- `.env` -- auto-managed
- `InlineModelSettings.tsx`, `ModelDefaultsSection.tsx`, `NewPromptChoiceDialog.tsx` -- pre-existing build errors, not in scope

## Security Considerations

- System credentials table has admin-only RLS (all 4 operations)
- `encrypt_system_credential` DB function double-checks `is_admin(auth.uid())` inside `SECURITY DEFINER`
- `decrypt_credential_with_fallback` is `SECURITY DEFINER` -- any call from service-role context can decrypt; RLS on the tables provides additional protection for direct access
- The encryption key (`CREDENTIALS_ENCRYPTION_KEY`) is the same for both tables -- no new secrets needed
- System credential values never reach the frontend (same pattern as user credentials)
- Non-admin users see only boolean status flags

## Migration Path

- Existing per-user keys continue to work as fallback
- Admin sets system keys via new UI section
- System keys take priority immediately for all users
- Per-user integration pages show "System key active" and hide input when system key exists

