
## Fix: Execute Post-Actions When Background (GPT-5) Responses Complete

### Problem

When an action node (like "Japan SSI Business Agreement Assessment") uses GPT-5, the request goes into background/webhook mode. The `handleRunPrompt` function exits early at line 520 with `return`, skipping the entire post-action pipeline (lines 609-830) that creates child prompts. When the response arrives via webhook/polling, the completion effect (lines 296-329) only shows a toast and refreshes the prompt data -- it never triggers the child creation logic.

```text
Normal flow (non-GPT-5):
  handleRunPrompt -> runPrompt -> result -> post-action -> children created

GPT-5 background flow (broken):
  handleRunPrompt -> runPrompt -> "long_running" interrupt -> RETURN (exit early)
  ... later ...
  webhook/polling delivers result -> toast shown -> prompt data refreshed
                                                     ^ post-action NEVER runs
```

### Solution

Add post-action execution to the webhook response delivery effect (the `useEffect` at lines 296-329). When a background response completes AND the prompt is an action node with a configured `post_action`, extract the JSON from `output_text`, validate it, and call `executePostAction` to create the children.

### Technical Changes

**File: `src/pages/MainLayout.tsx`**

Modify the GPT-5 webhook response delivery effect (~lines 296-329) to:

1. When `webhookComplete && webhookOutputText` is true, fetch the prompt data for `pendingWebhookPromptId`
2. Check if the prompt has `node_type === 'action'` and a `post_action` configured
3. If yes, run the same post-action pipeline used in `handleRunPrompt`:
   - Parse the JSON from `webhookOutputText` via `extractJsonFromResponse`
   - Store `extracted_variables` in the DB
   - Validate the response via `validateActionResponse`
   - Show the action preview dialog if `skip_preview` is not true
   - Execute `executePostAction` to create children
   - Store `last_action_result`
   - Refresh the tree data
   - Process variable assignments if configured
   - Auto-run children if `auto_run_children` is enabled
4. If parsing fails or no post-action is configured, fall through to the existing toast-only behavior

This reuses all existing executor logic -- no changes to `createChildrenJson.ts`, `createChildrenText.ts`, or any other executor.

### Edge Cases Handled

- **Non-action prompts**: The existing toast-only behavior remains unchanged for normal prompts using GPT-5 in background mode
- **skip_preview**: Honoured -- if the action config has `skip_preview: true`, children are created immediately without a dialog
- **JSON parse failure**: Caught and surfaced as a warning toast, same as the inline flow
- **Validation failure**: Surfaced as an error toast with suggestions, same as the inline flow
- **User navigated away from the prompt**: Post-action still executes since it uses `pendingWebhookPromptId` (not the currently selected prompt)

### Scope

- Only `src/pages/MainLayout.tsx` is modified
- No edge function changes needed
- No database changes needed
