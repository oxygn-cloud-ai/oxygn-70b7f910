// Shared SSE stream parsing utility for chat and conversation runs

export interface SSEParseCallbacks {
  onApiStarted?: (responseId: string) => void;
  onThinkingStarted?: () => void;
  onThinkingDelta?: (delta: string) => void;
  onThinkingDone?: (text?: string) => void;
  onOutputDelta?: (delta: string) => void;
  onOutputDone?: (text: string) => void;
  onToolStart?: (tool: string, args?: unknown) => void;
  onToolEnd?: (tool: string) => void;
  onToolLoopComplete?: () => void;
  onUsageDelta?: (inputTokens: number, outputTokens: number) => void;
  onStatusUpdate?: (status: string) => void;
  onProgress?: (message: string) => void;
  onHeartbeat?: (elapsedMs: number) => void;
  onError?: (error: string) => void;
}

export interface SSEParseResult {
  success: boolean;
  fullContent: string;
  responseId: string | null;
  usageData: { input_tokens: number; output_tokens: number };
  error?: string;
  cancelled?: boolean;
}

/**
 * Parse a line of SSE data and invoke the appropriate callback
 */
export function parseSSELine(
  line: string,
  callbacks: SSEParseCallbacks,
  state: { fullContent: string; responseId: string | null; usageData: { input_tokens: number; output_tokens: number } }
): void {
  const trimmedLine = line.trim();
  if (!trimmedLine || !trimmedLine.startsWith('data: ')) return;

  const data = trimmedLine.slice(6);
  if (data === '[DONE]') return;

  try {
    const parsed = JSON.parse(data);

    switch (parsed.type) {
      case 'api_started':
        state.responseId = parsed.response_id;
        callbacks.onApiStarted?.(parsed.response_id);
        break;

      case 'thinking_started':
        callbacks.onThinkingStarted?.();
        break;

      case 'thinking_delta':
        callbacks.onThinkingDelta?.(parsed.delta || '');
        break;

      case 'thinking_done':
        callbacks.onThinkingDone?.(parsed.text);
        break;

      case 'output_text_delta':
        if (parsed.delta) {
          state.fullContent += parsed.delta;
          callbacks.onOutputDelta?.(parsed.delta);
        }
        break;

      case 'output_text_done':
        if (parsed.text) {
          state.fullContent = parsed.text;
        }
        callbacks.onOutputDone?.(state.fullContent);
        break;

      case 'tool_start':
        callbacks.onToolStart?.(parsed.tool, parsed.args);
        break;

      case 'tool_end':
        callbacks.onToolEnd?.(parsed.tool);
        break;

      case 'tool_loop_complete':
        callbacks.onToolLoopComplete?.();
        break;

      case 'usage_delta':
        if (parsed.input_tokens) {
          state.usageData.input_tokens += parsed.input_tokens;
        }
        if (parsed.output_tokens) {
          state.usageData.output_tokens += parsed.output_tokens;
        }
        callbacks.onUsageDelta?.(parsed.input_tokens || 0, parsed.output_tokens || 0);
        break;

      case 'status_update':
        callbacks.onStatusUpdate?.(parsed.status);
        break;

      case 'progress':
        callbacks.onProgress?.(parsed.message);
        break;

      case 'heartbeat':
        callbacks.onHeartbeat?.(parsed.elapsed_ms);
        break;

      case 'error':
        callbacks.onError?.(parsed.error || 'Unknown error');
        break;
    }
  } catch (e) {
    // Only log non-JSON parse errors
    if (e instanceof Error && !e.message.includes('JSON')) {
      console.warn('SSE parse warning:', e);
    }
  }
}

/**
 * Process an SSE stream from a Response object
 */
export async function processSSEStream(
  response: Response,
  callbacks: SSEParseCallbacks,
  abortSignal?: AbortSignal
): Promise<SSEParseResult> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  const state = {
    fullContent: '',
    responseId: null as string | null,
    usageData: { input_tokens: 0, output_tokens: 0 }
  };

  if (!reader) {
    return {
      success: false,
      fullContent: '',
      responseId: null,
      usageData: state.usageData,
      error: 'No response body reader available'
    };
  }

  try {
    while (true) {
      if (abortSignal?.aborted) {
        return {
          success: false,
          ...state,
          cancelled: true
        };
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        parseSSELine(line, callbacks, state);
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      parseSSELine(buffer, callbacks, state);
    }

    return {
      success: true,
      ...state
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        ...state,
        cancelled: true
      };
    }
    throw error;
  }
}
