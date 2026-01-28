
# Combined Diagnostic & Fix Plan: Chat System Issues

## Overview

This plan addresses two related problems:
1. Chat failing due to wrong OpenAI error code detection
2. Chat appearing blocked during concurrent prompt execution

---

## Part A: Critical Bug Fix - Error Code Mismatch

### File: `supabase/functions/prompt-family-chat/index.ts`

**Change 1**: Fix the stale conversation detection (around line 1406)

```typescript
// BEFORE:
const isStaleConversation = 
  upstreamMessage.includes('No tool output found') ||
  upstreamMessage.includes('Cannot continue from response') ||
  parsedError?.error?.code === 'invalid_previous_response_id';

// AFTER:
const isStaleConversation = 
  upstreamMessage.includes('No tool output found') ||
  upstreamMessage.includes('Cannot continue from response') ||
  upstreamMessage.toLowerCase().includes('previous response') ||
  parsedError?.error?.code === 'previous_response_not_found' ||
  parsedError?.error?.code === 'invalid_previous_response_id';
```

**Change 2**: Add retry progress SSE event (around line 1413)

```typescript
if (isStaleConversation && requestBody.previous_response_id && !retryAttempted) {
  console.warn('Detected stale conversation state - clearing and retrying');
  retryAttempted = true;
  
  // Emit progress so frontend knows a retry is happening
  emitter.emit({ 
    type: 'progress', 
    message: 'Conversation context reset - retrying...',
  });
  
  // ... existing retry logic
}
```

**Change 3**: Add diagnostic logging after thread resolution

```typescript
console.log('[prompt-family-chat] Thread resolved:', {
  threadRowId,
  purpose: 'chat',
  lastResponseId,
  conversationId: threadInfo.openai_conversation_id,
});
```

**Change 4**: Add error analysis logging in catch block

```typescript
console.log('[DEBUG] Error analysis:', {
  status: apiResponse.status,
  errorCode: parsedError?.error?.code,
  errorMessage: parsedError?.error?.message,
  hasPreviousResponseId: !!requestBody.previous_response_id,
  retryAttempted
});
```

---

## Part B: Frontend Diagnostics

### File: `src/hooks/usePromptFamilyChatStream.ts`

**Change 1**: Add state monitoring effect (after line 42)

```typescript
// Debug: log streaming state changes
useEffect(() => {
  console.log('[ChatStream] State changed:', { 
    isStreaming, 
    messageLength: streamingMessage.length, 
    isExecutingTools,
    hasAbortController: !!abortControllerRef.current 
  });
}, [isStreaming, streamingMessage.length, isExecutingTools]);
```

**Change 2**: Enhance resetStreamState with logging (line 48)

```typescript
const resetStreamState = useCallback(() => {
  console.log('[ChatStream] RESET called');
  setStreamingMessage('');
  setThinkingText('');
  setToolActivity([]);
  setIsStreaming(false);
  setIsExecutingTools(false);
  toolActivityCountRef.current = 0;
}, []);
```

**Change 3**: Add entry logging in sendMessage (after line 77)

```typescript
console.log('[ChatStream] sendMessage starting:', {
  threadId,
  promptRowId,
  model: effectiveModel,
  currentlyStreaming: isStreaming,
});
```

**Change 4**: Add detailed error parsing (around line 150)

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('[ChatStream] Error response:', response.status, errorText);
  
  let errorMessage = 'Failed to get response';
  let errorCode: string | undefined;
  try {
    const parsed = JSON.parse(errorText);
    errorMessage = parsed.error || parsed.message || errorMessage;
    errorCode = parsed.error_code;
  } catch {
    errorMessage = errorText || errorMessage;
  }
  
  if (errorCode === 'OPENAI_NOT_CONFIGURED') {
    throw new Error('OpenAI API key not configured. Go to Settings → Integrations → OpenAI.');
  }
  
  throw new Error(errorMessage);
}
```

**Change 5**: Enhance progress handler to surface retries (around line 253)

```typescript
onProgress: (message) => {
  console.log('[ChatStream] Progress:', message);
  if (message.includes('reset') || message.includes('retry')) {
    notify.info('Reconnecting...', {
      source: 'ChatStream',
      description: message,
    });
  }
},
```

---

### File: `src/hooks/usePromptFamilyChat.ts`

**Change 1**: Add logging in root resolution effect (around line 96)

```typescript
useEffect(() => {
  const resolveRoot = async () => {
    console.log('[PromptFamilyChat] Resolving root for:', promptRowId);
    if (!promptRowId) {
      setRootPromptId(null);
      return;
    }
    const rootId = await computeRootPromptId(promptRowId);
    console.log('[PromptFamilyChat] Root resolved:', rootId);
    setRootPromptId(rootId);
  };
  resolveRoot();
}, [promptRowId, computeRootPromptId]);
```

**Change 2**: Add logging in sendMessage (around line 152)

```typescript
const sendMessage = useCallback(async (...) => {
  const effectiveThreadId = threadId || threadManager.activeThreadId;
  
  console.log('[PromptFamilyChat] sendMessage:', {
    hasMessage: !!userMessage.trim(),
    effectiveThreadId,
    activeThreadId: threadManager.activeThreadId,
    promptRowId,
    isStreaming: streamManager.isStreaming,
  });
  
  if (!effectiveThreadId || !userMessage.trim() || !promptRowId) {
    console.warn('[PromptFamilyChat] sendMessage BLOCKED:', {
      noThread: !effectiveThreadId,
      noMessage: !userMessage.trim(),
      noPrompt: !promptRowId
    });
    return null;
  }
  // ... rest
}, [...]);
```

---

### File: `src/components/layout/ConversationPanel.tsx`

**Change 1**: Enhance handleSend with comprehensive diagnostics (around line 158)

```typescript
const handleSend = async () => {
  const debugState = {
    hasInput: !!inputValue.trim(),
    isSending,
    isStreaming: promptFamilyChat?.isStreaming,
    isExecutingTools: promptFamilyChat?.isExecutingTools,
    activeThreadId: promptFamilyChat?.activeThreadId,
    threadCount: promptFamilyChat?.threads.length,
  };
  
  console.log('[ConversationPanel] handleSend:', debugState);
  
  if (!inputValue.trim()) {
    console.warn('[ConversationPanel] BLOCKED: empty input');
    return;
  }
  
  if (isSending) {
    console.warn('[ConversationPanel] BLOCKED: isSending=true');
    toast.warning('Please wait for the current message to complete');
    return;
  }
  
  // ... rest of existing code
};
```

---

### File: `src/hooks/usePromptFamilyThreads.ts`

**Change 1**: Add logging in createThread (around line 91)

```typescript
const response = await supabase.functions.invoke('thread-manager', {
  body: {
    action: 'create',
    root_prompt_row_id: rootPromptId,
    name: title,
    purpose: 'chat',
  }
});

console.log('[PromptFamilyThreads] createThread result:', {
  success: !response.error,
  threadId: response.data?.thread?.row_id,
  purpose: response.data?.thread?.purpose,
});
```

---

## Summary of All Changes

| File | Type | Changes |
|------|------|---------|
| `supabase/functions/prompt-family-chat/index.ts` | Bug Fix + Diagnostics | Fix error code, add retry event, add logging |
| `src/hooks/usePromptFamilyChatStream.ts` | Diagnostics | State monitoring, entry logging, error parsing |
| `src/hooks/usePromptFamilyChat.ts` | Diagnostics | Root resolution logging, sendMessage logging |
| `src/components/layout/ConversationPanel.tsx` | Diagnostics | Comprehensive send blocking detection |
| `src/hooks/usePromptFamilyThreads.ts` | Diagnostics | Thread creation logging |

---

## Testing After Implementation

1. Open browser console
2. Start a cascade run on any prompt
3. Immediately try sending a chat message
4. Look for these log patterns:
   - `[ConversationPanel] BLOCKED:` - Shows what's preventing send
   - `[ChatStream] State changed:` - Shows if streaming state is stuck
   - `[PromptFamilyChat] sendMessage BLOCKED:` - Shows missing prerequisites
5. If chat fails with stale conversation, verify:
   - `[DEBUG] Error analysis:` shows `previous_response_not_found`
   - Retry progress toast appears
   - Second attempt succeeds

---

## Pre-existing Issue (Not Addressed)

The `tsconfig.json` build error is a known platform constraint and is **not related** to chat functionality.
