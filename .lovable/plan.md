

## Investigation Results: GPT-5 `extractOutputText` Failure — Confirmed

### Evidence

Database analysis proves that `extractOutputText` in `openai-webhook` is systematically failing for ALL GPT-5 responses:

| Field | Value |
|---|---|
| `q_pending_responses.output_text` | **Empty string** for ALL 10 most recent completed responses |
| `q_pending_responses.webhook_event_id` | Real webhook event IDs (not `poll_fallback_*`) — confirming webhooks ARE firing |
| `q_prompts.output_response` | **Has content** for some prompts — written by `poll-openai-response` fallback |

This means: Webhook fires → `extractOutputText` returns `''` → empty string stored in `output_text` → `[DIAG]` log fires (but logs have expired, last activity was Feb 22) → poll fallback sometimes writes output to `q_prompts` directly, but `q_pending_responses.output_text` remains empty.

### Root Cause Analysis

The `extractOutputText` function (webhook line 129-141) and `extractContent` function (poll line 36-60) both filter for `item.type === 'message'`. If GPT-5's webhook payload uses a different output item type (e.g., `'text'`, `'output'`, or a nested structure), the entire extraction loop yields nothing.

Additionally, line 134 in the webhook has a **falsy guard on the text value itself**: `&& c.text` — if any content block has an empty string `text` field, it would be skipped. The poll function (line 52) correctly uses `typeof block.text === 'string'` instead.

### Why We Cannot Diagnose Further Without a Live Run

The `[DIAG]` logs that would reveal the exact GPT-5 payload structure have expired (last run was Feb 22, 4 days ago). Edge function logs typically expire after ~1 hour. A fresh cascade run is required to capture the diagnostic output.

### What Needs to Happen

**Step 1: Trigger a fresh GPT-5 run** — You need to run a single GPT-5 prompt (not necessarily the full Reporter Confidentiality cascade) from the app UI.

**Step 2: Check logs immediately** — Within minutes of the run completing, tell me to check the `openai-webhook` edge function logs for `[DIAG]` entries. The log will contain `rawOutputPreview` showing the exact payload structure GPT-5 sends.

**Step 3: Fix `extractOutputText`** — Based on the payload structure revealed in Step 2, update the extraction logic to handle GPT-5's output format. At minimum, the following fixes are already identifiable:

- **Webhook line 134:** Change `&& c.text` to `&& typeof c.text === 'string'` (matching the poll function's approach) to avoid falsy-skipping empty strings
- **Both functions:** Potentially add additional `item.type` checks if GPT-5 uses a type other than `'message'`

### Recommended Action

Run any single GPT-5 prompt from the app right now, then immediately ask me to check the webhook logs. This will reveal the exact payload format and allow a targeted fix in the same session.

