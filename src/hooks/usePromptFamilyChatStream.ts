import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/contexts/ToastHistoryContext';
import { trackEvent, trackException } from '@/lib/posthog';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { estimateRequestTokens, getModelContextWindow } from '@/utils/tokenizer';
import { parseSSELine } from '@/utils/sseStreamParser';
import type { ToolActivity, UsageData, ChatMessage } from '@/types/chat';

export interface StreamCallbacks {
  onMessageComplete: (content: string, threadId: string) => Promise<ChatMessage | null>;
  onUpdateLastMessageAt: (threadId: string) => Promise<void>;
}

export interface UsePromptFamilyChatStreamReturn {
  isStreaming: boolean;
  streamingMessage: string;
  thinkingText: string;
  toolActivity: ToolActivity[];
  isExecutingTools: boolean;
  sendMessage: (
    userMessage: string,
    threadId: string,
    promptRowId: string,
    model: string | null,
    reasoningEffort: string,
    callbacks: StreamCallbacks
  ) => Promise<string | null>;
  cancelStream: () => void;
  resetStreamState: () => void;
}

export function usePromptFamilyChatStream(): UsePromptFamilyChatStreamReturn {
  const { registerCall } = useApiCallContext();
  const { addCall, updateCall, appendThinking, appendOutputText, incrementOutputTokens, removeCall } = useLiveApiDashboard();
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [thinkingText, setThinkingText] = useState('');
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);
  const [isExecutingTools, setIsExecutingTools] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const dashboardCallIdRef = useRef<string | null>(null);
  const toolActivityCountRef = useRef(0);

  // Debug: log streaming state changes for concurrency diagnostics
  React.useEffect(() => {
    console.log('[ChatStream] State changed:', { 
      isStreaming, 
      messageLength: streamingMessage.length, 
      isExecutingTools,
      hasAbortController: !!abortControllerRef.current 
    });
  }, [isStreaming, streamingMessage.length, isExecutingTools]);

  const resetStreamState = useCallback(() => {
    console.log('[ChatStream] RESET called');
    setStreamingMessage('');
    setThinkingText('');
    setToolActivity([]);
    setIsStreaming(false);
    setIsExecutingTools(false);
    toolActivityCountRef.current = 0;
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (dashboardCallIdRef.current) {
      removeCall(dashboardCallIdRef.current);
      dashboardCallIdRef.current = null;
    }
  }, [removeCall]);

  const sendMessage = useCallback(async (
    userMessage: string,
    threadId: string,
    promptRowId: string,
    model: string | null,
    reasoningEffort: string,
    callbacks: StreamCallbacks
  ): Promise<string | null> => {
    const effectiveModel = model || 'gpt-4o';
    
    // Diagnostic: log entry state for concurrency debugging
    console.log('[ChatStream] sendMessage starting:', {
      threadId,
      promptRowId,
      model: effectiveModel,
      currentlyStreaming: isStreaming,
      hasAbortController: !!abortControllerRef.current,
    });
    
    // Notify message sent
    notify.info('Message sent', { 
      source: 'usePromptFamilyChatStream.sendMessage',
      description: userMessage.slice(0, 100) + (userMessage.length > 100 ? '...' : ''),
      details: JSON.stringify({
        promptRowId,
        threadId,
        model: effectiveModel,
        reasoningEffort,
        messageLength: userMessage.length,
      }, null, 2),
    });

    setIsStreaming(true);
    setStreamingMessage('');
    setToolActivity([]);
    setIsExecutingTools(false);
    toolActivityCountRef.current = 0;

    const unregisterCall = registerCall();
    abortControllerRef.current = new AbortController();
    
    // Add abort detection logging
    abortControllerRef.current.signal.addEventListener('abort', () => {
      console.warn('[ChatStream] Fetch aborted - signal received');
    });
    
    // 5-minute fetch timeout
    const fetchTimeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        console.warn('[ChatStream] Fetch timeout - aborting after 5 minutes');
        abortControllerRef.current.abort();
      }
    }, 300000);

    // Estimate tokens for dashboard
    const estimatedInputTokens = estimateRequestTokens({ userMessage });
    const contextWindow = getModelContextWindow(effectiveModel);

    // Register with LiveApiDashboard
    const dashboardId = addCall({
      promptName: 'Prompt Family Chat',
      promptRowId,
      model: effectiveModel,
      status: 'queued',
      cancelFn: async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      },
      isCascadeCall: false,
      estimatedInputTokens,
      contextWindow,
    });
    dashboardCallIdRef.current = dashboardId;

    trackEvent('prompt_family_message_sent', {
      prompt_id: promptRowId,
      thread_id: threadId,
      message_length: userMessage.length,
    });

    // Declare timeout variable OUTSIDE try block to fix scoping bug
    let streamingFlushTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      console.log('[ChatStream] Starting fetch to prompt-family-chat');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompt-family-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            prompt_row_id: promptRowId,
            user_message: userMessage,
            model: model || null,
            reasoning_effort: reasoningEffort
          }),
          signal: abortControllerRef.current?.signal
        }
      );

      console.log('[ChatStream] Response status:', response.status, 'ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to get response';
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        console.error('[ChatStream] Error response:', errorMessage);
        throw new Error(errorMessage);
      }

      updateCall(dashboardId, { status: 'in_progress' });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let responseId: string | null = null;
      const usageData: UsageData = { input_tokens: 0, output_tokens: 0 };

      // Minimal state object for SSE parser (not used, callbacks handle state)
      const parseState = { fullContent: '', responseId: null as string | null, usageData: { input_tokens: 0, output_tokens: 0 } };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            parseSSELine(line, {
              onApiStarted: (id) => {
                responseId = id;
                updateCall(dashboardId, { 
                  status: 'in_progress',
                  responseId: id,
                });
              },
              onThinkingStarted: () => {
                setThinkingText('');
              },
              onThinkingDelta: (delta) => {
                setThinkingText(prev => prev + delta);
                appendThinking(dashboardId, delta);
              },
              onThinkingDone: (text) => {
                if (text) setThinkingText(text);
              },
              onOutputDelta: (delta) => {
                fullContent += delta;
                appendOutputText(dashboardId, delta);
                
                // Debounce UI updates
                if (!streamingFlushTimeout) {
                  streamingFlushTimeout = setTimeout(() => {
                    setStreamingMessage(fullContent);
                    streamingFlushTimeout = null;
                  }, 50);
                }
              },
              onOutputDone: (text) => {
                if (streamingFlushTimeout) {
                  clearTimeout(streamingFlushTimeout);
                  streamingFlushTimeout = null;
                }
                fullContent = text || fullContent;
                setStreamingMessage(fullContent);
                updateCall(dashboardId, { outputText: fullContent });
              },
              onStatusUpdate: (status) => {
                updateCall(dashboardId, { status });
              },
              onUsageDelta: (inputTokens, outputTokens) => {
                usageData.input_tokens += inputTokens;
                usageData.output_tokens += outputTokens;
                if (outputTokens) {
                  incrementOutputTokens(dashboardId, outputTokens);
                }
              },
              onProgress: (message) => {
                console.log('[ChatStream] Progress:', message);
                // Surface retry notifications to user
                if (message.includes('reset') || message.includes('retry')) {
                  notify.info('Reconnecting...', {
                    source: 'ChatStream',
                    description: message,
                  });
                }
              },
              onHeartbeat: (elapsedMs) => {
                console.log('[ChatStream] Heartbeat:', elapsedMs, 'ms');
              },
              onError: (error) => {
                throw new Error(error);
              },
              onToolStart: (tool, args) => {
                setToolActivity(prev => {
                  const newActivity = [...prev, { name: tool, args: args as Record<string, unknown>, status: 'running' as const }];
                  toolActivityCountRef.current = newActivity.length;
                  return newActivity;
                });
                setIsExecutingTools(true);
              },
              onToolEnd: (tool) => {
                setToolActivity(prev => prev.map(t => 
                  t.name === tool && t.status === 'running'
                    ? { ...t, status: 'complete' as const }
                    : t
                ));
              },
              onToolLoopComplete: () => {
                setIsExecutingTools(false);
              },
            }, parseState);
          }
        }
      }

      console.log('[ChatStream] Stream ended, fullContent length:', fullContent.length);
      
      // Add assistant message if we have content
      if (fullContent.trim().length > 0) {
        console.log('[ChatStream] Adding assistant message to chat');
        await callbacks.onMessageComplete(fullContent, threadId);
      } else if (toolActivityCountRef.current === 0) {
        console.warn('[ChatStream] Empty response received');
        notify.warning('No response received', {
          source: 'usePromptFamilyChatStream',
          description: 'The AI returned an empty response. Please try again.',
        });
      }
      
      // Notify success
      notify.success('AI response received', { 
        source: 'usePromptFamilyChatStream.sendMessage',
        description: fullContent.slice(0, 100) + (fullContent.length > 100 ? '...' : ''),
        details: JSON.stringify({
          promptRowId,
          threadId,
          model: effectiveModel,
          responseId,
          usage: usageData,
          responseLength: fullContent.length,
          toolsUsed: toolActivity.map(t => t.name),
        }, null, 2),
      });
      
      // Cleanup
      if (streamingFlushTimeout) {
        clearTimeout(streamingFlushTimeout);
        streamingFlushTimeout = null;
      }
      clearTimeout(fetchTimeoutId);
      
      resetStreamState();
      unregisterCall();
      abortControllerRef.current = null;
      removeCall(dashboardId);
      dashboardCallIdRef.current = null;

      // Update thread timestamp
      await callbacks.onUpdateLastMessageAt(threadId);

      trackEvent('prompt_family_response_received', {
        prompt_id: promptRowId,
        thread_id: threadId,
        response_length: fullContent.length,
      });

      return fullContent;
    } catch (error) {
      // Cleanup timeout
      if (streamingFlushTimeout) {
        clearTimeout(streamingFlushTimeout);
        streamingFlushTimeout = null;
      }
      clearTimeout(fetchTimeoutId);
      
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sending message:', error);
        notify.error(error.message || 'Failed to get AI response', {
          source: 'usePromptFamilyChatStream.sendMessage',
          errorCode: 'CHAT_ERROR',
          details: JSON.stringify({
            promptRowId,
            threadId,
            model: effectiveModel,
            errorMessage: error.message,
          }, null, 2),
        });
        trackException(error, { context: 'prompt_family_chat_stream' });
      }
      
      resetStreamState();
      unregisterCall();
      abortControllerRef.current = null;
      
      if (dashboardCallIdRef.current) {
        removeCall(dashboardCallIdRef.current);
        dashboardCallIdRef.current = null;
      }
      
      return null;
    }
  }, [registerCall, addCall, updateCall, appendThinking, appendOutputText, incrementOutputTokens, removeCall, resetStreamState]);

  return {
    isStreaming,
    streamingMessage,
    thinkingText,
    toolActivity,
    isExecutingTools,
    sendMessage,
    cancelStream,
    resetStreamState,
  };
}
