/**
 * Anthropic Messages API Adapter
 * Converts OpenAI-style requests to Anthropic format
 * 
 * ARCHITECTURAL NOTE: Unlike OpenAI's Conversations API which maintains
 * server-side state via previous_response_id, Anthropic requires full
 * message history to be passed with each request (stateless).
 */

// === TYPE DEFINITIONS ===

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;  // REQUIRED for Anthropic
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop_sequences?: string[];
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicStreamEvent {
  type: 'content_block_delta' | 'message_delta' | 'message_stop' | 'message_start' | 'content_block_start' | 'content_block_stop' | 'ping' | 'error';
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string;
  };
  message?: {
    id: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  usage?: {
    output_tokens: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

// Standard SSE event format (matches existing system)
export type StandardSSEEvent = 
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'usage'; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
  | { type: 'error'; error: string; error_code: string };

// === CONSTANTS ===

const ANTHROPIC_API_VERSION = '2024-10-22';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

// === CONVERSION FUNCTIONS ===

/**
 * Convert OpenAI-style messages to Anthropic format
 * Extracts system message to top-level param
 */
export function convertToAnthropicFormat(
  messages: Array<{ role: string; content: string }>,
  existingSystemPrompt?: string
): { messages: AnthropicMessage[]; system?: string } {
  let system = existingSystemPrompt || '';
  const converted: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = system ? `${system}\n\n${msg.content}` : msg.content;
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      converted.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return {
    messages: converted,
    system: system || undefined,
  };
}

/**
 * Build Anthropic API request body
 */
export function buildAnthropicRequest(
  model: string,
  messages: AnthropicMessage[],
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stream?: boolean;
    stopSequences?: string[];
  } = {}
): AnthropicRequest {
  const request: AnthropicRequest = {
    model,
    max_tokens: options.maxTokens || 4096,  // REQUIRED
    messages,
  };

  if (options.systemPrompt) {
    request.system = options.systemPrompt;
  }
  if (options.temperature !== undefined) {
    request.temperature = options.temperature;
  }
  if (options.topP !== undefined) {
    request.top_p = options.topP;
  }
  if (options.stream !== undefined) {
    request.stream = options.stream;
  }
  if (options.stopSequences?.length) {
    request.stop_sequences = options.stopSequences;
  }

  return request;
}

/**
 * Parse Anthropic response to standard format
 */
export function parseAnthropicResponse(response: AnthropicResponse): {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  responseId: string;
  stopReason: string;
} {
  const textContent = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return {
    content: textContent,
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
    responseId: response.id,
    stopReason: response.stop_reason,
  };
}

/**
 * Parse Anthropic streaming event to standard SSE format
 * Returns null for events that should be ignored
 */
export function parseAnthropicStreamEvent(
  event: AnthropicStreamEvent
): StandardSSEEvent | null {
  switch (event.type) {
    case 'content_block_delta':
      if (event.delta?.type === 'text_delta' && event.delta.text) {
        return { type: 'text', text: event.delta.text };
      }
      break;
    case 'message_delta':
      if (event.usage) {
        return {
          type: 'usage',
          usage: {
            prompt_tokens: 0,  // Not provided in delta
            completion_tokens: event.usage.output_tokens,
            total_tokens: event.usage.output_tokens,
          },
        };
      }
      break;
    case 'message_stop':
      return { type: 'done' };
    case 'error':
      return {
        type: 'error',
        error: event.error?.message || 'Unknown Anthropic error',
        error_code: 'ANTHROPIC_API_ERROR',
      };
    case 'ping':
    case 'message_start':
    case 'content_block_start':
    case 'content_block_stop':
      // These events don't produce output
      break;
  }
  return null;
}

// === API CALL FUNCTIONS ===

/**
 * Get Anthropic API headers
 */
function getAnthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_API_VERSION,
    'content-type': 'application/json',
  };
}

/**
 * Call Anthropic Messages API (non-streaming)
 */
export async function callAnthropicAPI(
  apiKey: string,
  request: AnthropicRequest
): Promise<AnthropicResponse> {
  const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
    method: 'POST',
    headers: getAnthropicHeaders(apiKey),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<AnthropicResponse>;
}

/**
 * Call Anthropic Messages API (streaming)
 * Returns the raw Response for SSE processing
 */
export async function callAnthropicAPIStreaming(
  apiKey: string,
  request: AnthropicRequest
): Promise<Response> {
  return fetch(`${ANTHROPIC_BASE_URL}/messages`, {
    method: 'POST',
    headers: getAnthropicHeaders(apiKey),
    body: JSON.stringify({ ...request, stream: true }),
  });
}
