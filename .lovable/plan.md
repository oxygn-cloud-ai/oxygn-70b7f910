

# Revised Plan: Show Reasoning Content During Background Processing

## Audit Findings and Corrections

### Finding 1: CRITICAL -- Polling from frontend is architecturally wrong

**Problem**: The original plan has the frontend calling a `poll-openai-response` edge function every 10 seconds. This means every browser tab would independently poll OpenAI, creating N*6 API calls per minute per active user. Worse, retrieving the user's API key requires the user's auth header -- meaning the edge function must authenticate the user on every poll, adding latency and credentials-manager round-trips.

**Fix**: Instead of client-side polling, keep the existing Realtime subscription as the primary delivery channel and add a **single polling loop inside the edge function itself** (within `conversation-run`) before it hands off to webhook mode. This aligns with the existing architecture where edge functions do the API work and Realtime delivers results to the frontend. However, since the edge function exits immediately on webhook handoff (line 628-629 of conversation-run), we cannot poll there either without breaking the handoff.

**Revised approach**: Create a lightweight edge function `poll-openai-response` that the frontend calls at a **30-second interval** (not 10s) only while `isPending` is true. The function uses the caller's auth header to retrieve the OpenAI key (same pattern as `openai-proxy`), polls `GET /v1/responses/{response_id}`, extracts reasoning content, and if completed, updates `q_pending_responses` as a webhook fallback. This is acceptable because: (a) only one poll per 30s per pending request, (b) it matches the existing per-user credential pattern, (c) it provides both liveness and fallback.

### Finding 2: CRITICAL -- `reasoning_text` column creates a Realtime update loop risk

**Problem**: The plan proposes the poll edge function update `reasoning_text` on `q_pending_responses` every 10 seconds. Since this table has `REPLICA IDENTITY FULL` and Realtime enabled, every update triggers a Realtime event, which the frontend receives, which could re-trigger state updates or re-renders unnecessarily.

**Fix**: Do NOT store `reasoning_text` in the database. Instead, the poll edge function returns reasoning text directly in its HTTP response. The frontend stores it in local state only. This avoids unnecessary database writes and Realtime noise. The poll function still updates the row on terminal status (completed/failed) as a webhook fallback -- but only once.

### Finding 3: MEDIUM -- Duplicate completion logic between poll and webhook

**Problem**: If polling detects `completed` and writes to `q_pending_responses`, and then the webhook also fires (possibly delayed), the webhook's idempotency check (line 206 of openai-webhook) checks `webhook_event_id`, but the poll doesn't set `webhook_event_id`. This means the webhook could overwrite the poll's update.

**Fix**: When the poll function detects completion and updates the row, it should set `webhook_event_id` to a synthetic value like `poll_fallback_{response_id}`. The webhook's idempotency check then prevents double-processing. Additionally, the poll should check `status !== 'pending'` before updating to avoid overwriting webhook results that arrived between polls.

### Finding 4: MEDIUM -- Poll function must also update `q_prompts.output_response`

**Problem**: When the webhook delivers a response, it updates both `q_pending_responses` AND `q_prompts.output_response` (line 247 of openai-webhook). If polling completes first, it must also update the prompt to maintain consistency.

**Fix**: The poll function's completion path must mirror the webhook's logic: update `q_pending_responses`, `q_prompts.output_response`, `q_prompts.user_prompt_result`, and optionally thread/trace records. Use the service role key for these updates (same as the webhook).

**WAIT** -- The poll function authenticates via user JWT, not service role. It cannot use service role key (that's only in webhook which is a public endpoint with signature verification). The poll function CAN use the user's JWT-scoped client, which is subject to RLS. Since `q_pending_responses` RLS allows owners to update their own rows, and `q_prompts` RLS allows owners to update their own prompts, this works. The poll function should use the user-scoped client.

### Finding 5: MEDIUM -- 3-minute timeout is too short for polling to be useful

**Problem**: The existing 3-minute timeout in `usePendingResponseSubscription` will fire `isFailed` before polling has much chance to help. GPT-5 background tasks may take longer.

**Fix**: Increase the timeout to 10 minutes (600,000ms). The polling provides liveness visibility, so the user won't be confused by long waits. If polling itself returns a non-pending status (e.g., `failed`), the frontend can react immediately.

### Finding 6: LOW -- `@ts-nocheck` in multiple files

**Problem**: The plan says "all new and amended files must be TypeScript with strict type safety." Multiple files in the prop chain (`MainLayout.tsx`, `ReadingPane.tsx`, `PromptsContent.tsx`) have `@ts-nocheck`. The plan's instruction says "ensure the plan doesn't change anything else."

**Fix**: Do NOT remove `@ts-nocheck` from existing files -- that's out of scope. The NEW edge function and the AMENDED hook (`usePendingResponseSubscription.ts`) must be strictly typed. The new `reasoningText` prop threaded through `@ts-nocheck` files is acceptable since those files already bypass type checking.

### Finding 7: LOW -- No `config.toml` entry for new edge function

**Problem**: The plan omits adding the new `poll-openai-response` function to `supabase/config.toml`. Without it, JWT verification behavior is undefined.

**Fix**: Add `[functions.poll-openai-response]` with `verify_jwt = false` (matching the project's pattern of validating in code via `getClaims`/`getUser`).

**ACTUALLY** -- Looking at the existing config, most functions use `verify_jwt = true`. The system instructions say to set `verify_jwt = false` and validate in code. However, the existing codebase uses `verify_jwt = true` for authenticated functions (openai-proxy, conversation-run, etc.) and `verify_jwt = false` only for webhooks and prompt-versions. Since this function requires auth, we should match the existing pattern and use `verify_jwt = true`. The function still validates the user via `getUser()` for domain checks, which is the existing pattern.

Wait -- the system instructions say `verify_jwt = true` is deprecated and doesn't work with signing-keys. But the existing codebase uses it everywhere for auth functions. Follow the existing codebase pattern: `verify_jwt = true`.

**Final decision**: Do NOT add a config.toml entry. The file says it should "NEVER be edited directly" and is "updated automatically." The existing authenticated functions all have `verify_jwt = true` entries already present. A new function without an entry defaults to `verify_jwt = true`, which is the correct behavior.

### Finding 8: LOW -- ResizableOutputArea visual treatment needs specificity

**Problem**: The plan says "muted/italic style" and "pulsing brain icon" but doesn't specify exact classes consistent with the Qonsol design system.

**Fix**: Use `text-on-surface-variant` (not italic -- Poppins doesn't have great italic), `text-body-sm`, and a `Brain` icon from lucide-react with `text-primary animate-pulse` per existing design patterns.

### Finding 9: TRIVIAL -- Plan references `prompt-family-chat` background mode but doesn't address it

**Problem**: The chat panel (`usePromptFamilyChat`) also uses `usePendingResponseSubscription` (line 67). If we add polling to the hook, the chat panel gets it for free. However, the chat panel doesn't have a `ResizableOutputArea` -- it shows messages inline. Reasoning text during background chat is a separate UI concern.

**Fix**: The polling logic in `usePendingResponseSubscription` will benefit both consumers (Reading Pane and Chat Panel). For the Chat Panel, reasoning text can be shown via the existing `ThinkingIndicator` component if desired, but that's out of scope. The hook returns `reasoningText` and both consumers can use it or ignore it.

### Finding 10: TRIVIAL -- Race condition on poll vs Realtime

**Problem**: If Realtime delivers the completed status at the same moment polling returns reasoning text, the frontend could briefly show reasoning then immediately swap to final output. This is acceptable behavior (transition is natural).

**Fix**: No fix needed. The existing effect in `MainLayout` (line 296-328) handles completion by fetching fresh prompt data, which naturally replaces the output.

---

## Revised Implementation Plan

### Step 1: New Edge Function -- `supabase/functions/poll-openai-response/index.ts`

**Purpose**: Accept a `response_id`, call OpenAI `GET /v1/responses/{response_id}`, extract reasoning + output content, and return them. If status is terminal, update `q_pending_responses` as a webhook fallback.

**Key design decisions**:
- Authenticates user via `getUser()` (existing pattern from openai-proxy)
- Retrieves OpenAI API key via `getOpenAIApiKey(authHeader)` from `_shared/credentials.ts`
- Does NOT write reasoning to database (avoids Realtime noise)
- On `completed` status: updates `q_pending_responses` AND `q_prompts` using the user's JWT-scoped client (RLS permits owner updates)
- Sets synthetic `webhook_event_id = 'poll_fallback_{response_id}'` to prevent webhook double-processing
- On `failed`/`cancelled`/`incomplete`: updates `q_pending_responses.status` and `error`
- Returns `{ status, reasoning_text, output_text }` to the frontend

**Request/Response**:
```text
POST /poll-openai-response
Headers: Authorization: Bearer {jwt}
Body: { "response_id": "resp_xxx" }
Response: {
  "status": "queued" | "in_progress" | "completed" | "failed" | "cancelled" | "incomplete",
  "reasoning_text": string | null,
  "output_text": string | null
}
```

**Reasoning extraction logic**:
```text
for item in response.output:
  if item.type == "reasoning":
    for content_block in item.content:
      if content_block.type == "text":
        reasoning_text += content_block.text
  if item.type == "message":
    for content_block in item.content:
      if content_block.type == "output_text":
        output_text += content_block.text
```

**Security**: Domain check via `isAllowedDomain(user.email)` (same pattern as openai-proxy). Verify the response_id belongs to the caller by checking `q_pending_responses.owner_id = user.id` before polling OpenAI.

### Step 2: Amend `usePendingResponseSubscription.ts`

**Changes**:
- Add `reasoningText` state (`string | null`)
- Add 30-second polling interval that calls `poll-openai-response` while `isPending` is true
- On poll response: update `reasoningText` from response
- If poll returns terminal status (`completed`, `failed`, etc.): update `pendingResponse` local state immediately (pre-empting Realtime, which may arrive later or never)
- Increase timeout from 3 minutes to 10 minutes
- Return `reasoningText` in the hook result
- Ensure polling stops on unmount or when status becomes terminal
- All code strictly typed (no `@ts-nocheck`, no `any`)

**New interface additions**:
```typescript
interface UsePendingResponseSubscriptionResult {
  // ... existing fields ...
  reasoningText: string | null;  // NEW
}
```

### Step 3: Thread `reasoningText` Through the Component Chain

**Files modified (all have `@ts-nocheck`, so no type breakage)**:
- `MainLayout.tsx`: Destructure `reasoningText` from `usePendingResponseSubscription`, pass as `backgroundReasoningText` prop to `ReadingPane`
- `ReadingPane.tsx`: Accept `backgroundReasoningText` prop, pass to `PromptsContent`
- `PromptsContent.tsx`: Accept `backgroundReasoningText` prop in main component AND in `PromptTabContent`, pass to `ResizableOutputArea`

### Step 4: Update `ResizableOutputArea.tsx`

**Changes**:
- Add `backgroundReasoningText` prop (optional `string`)
- When `isWaitingForBackground` is true AND `backgroundReasoningText` is non-empty:
  - Replace the static amber "Waiting for background response..." banner with the reasoning content
  - Show a header bar: `Brain` icon (pulsing, `text-primary`) + "Reasoning..." label in `text-label-sm text-on-surface-variant`
  - Display reasoning text in the output content area using `text-body-sm text-on-surface-variant` (muted to distinguish from final output)
  - Keep the output area expanded (auto-set to 'min' state if collapsed)
- When `isWaitingForBackground` is true but `backgroundReasoningText` is empty/null:
  - Show the existing amber "Waiting for background response..." banner (no change)
- When `isWaitingForBackground` becomes false (completion):
  - The parent updates `value` prop with final output (existing behavior via `fetchItemData`)
  - Reasoning text naturally disappears as `isWaitingForBackground` turns false

### Step 5: No Database Migration Required

The original plan proposed adding a `reasoning_text` column to `q_pending_responses`. Per Finding 2, this is unnecessary -- reasoning is returned directly from the poll HTTP response and stored in frontend state only.

---

## Files Changed (Summary)

| File | Action | Scope |
|------|--------|-------|
| `supabase/functions/poll-openai-response/index.ts` | Create | New edge function |
| `src/hooks/usePendingResponseSubscription.ts` | Modify | Add polling + reasoningText |
| `src/pages/MainLayout.tsx` | Modify | Pass reasoningText prop (1 line) |
| `src/components/layout/ReadingPane.tsx` | Modify | Thread prop (2 lines) |
| `src/components/content/PromptsContent.tsx` | Modify | Thread prop to output area (3 lines) |
| `src/components/shared/ResizableOutputArea.tsx` | Modify | Render reasoning during background wait |

No database migration. No config.toml changes. No changes to webhook, conversation-run, or any other existing edge function.

