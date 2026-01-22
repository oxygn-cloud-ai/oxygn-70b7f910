/**
 * API Types
 * Type definitions for API calls, errors, and responses
 */

import type { TokenUsage } from './prompt.types';

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  title: string;
  message: string;
  recoverable: boolean;
  original?: string;
}

/**
 * Parsed API error
 */
export interface ParsedApiError extends ApiError {
  promptName?: string;
}

/**
 * API call state
 */
export interface ApiCallState {
  isInProgress: boolean;
  pendingCount: number;
  backgroundCalls: BackgroundCall[];
}

/**
 * Background call info
 */
export interface BackgroundCall {
  id: string;
  name: string;
  type: 'cascade' | 'single' | 'manus';
  startTime: number;
  promptName?: string;
}

/**
 * Live API call for dashboard
 */
export interface LiveApiCall {
  id: string;
  promptName: string;
  model: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  startTime: number;
  endTime?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  thinkingSummary?: string;
  outputPreview?: string;
  error?: string;
  isCascadeCall?: boolean;
}

/**
 * Cumulative stats for API dashboard
 */
export interface CumulativeStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  callCount: number;
}

/**
 * OpenAI API response
 */
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: TokenUsage;
}

/**
 * OpenAI choice
 */
export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

/**
 * OpenAI message
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}

/**
 * OpenAI tool call
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Streaming event types
 */
export type StreamEventType = 
  | 'response.created'
  | 'response.in_progress'
  | 'response.output_item.added'
  | 'response.output_text.delta'
  | 'response.output_text.done'
  | 'response.completed'
  | 'response.failed'
  | 'response.requires_action'
  | 'error';

/**
 * Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp?: number;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  usage?: TokenUsage;
}

/**
 * Thread data
 */
export interface ThreadData {
  row_id: string;
  name?: string;
  created_at: string;
  updated_at?: string;
  last_response_id?: string;
  openai_conversation_id?: string;
  message_count?: number;
}

/**
 * Manus task state
 */
export interface ManusTaskState {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  taskUrl?: string;
  response?: string;
  attachments?: ManusAttachment[];
  error?: string;
}

/**
 * Manus attachment
 */
export interface ManusAttachment {
  name: string;
  url: string;
  type: string;
}

/**
 * Cost record
 */
export interface CostRecord {
  row_id: string;
  prompt_row_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
  user_id?: string;
}

/**
 * Model pricing
 */
export interface ModelPricing {
  input: number;  // Cost per 1M tokens
  output: number; // Cost per 1M tokens
}

/**
 * Execution trace span
 */
export interface TraceSpan {
  id: string;
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error';
  metadata?: Record<string, unknown>;
  parentSpanId?: string;
}
