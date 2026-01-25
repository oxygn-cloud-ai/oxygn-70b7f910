// Chat-related TypeScript types for prompt family conversations

export interface ChatThread {
  row_id: string;
  name: string | null;  // Fixed: matches q_threads.name column
  root_prompt_row_id: string | null;  // Fixed: allow null per DB schema
  openai_conversation_id: string | null;
  owner_id: string | null;  // Fixed: allow null per DB schema
  is_active: boolean | null;  // Fixed: allow null per DB schema
  last_message_at: string | null;
  created_at: string | null;  // Fixed: allow null per DB schema
  updated_at?: string | null;
  // Additional columns from DB
  provider?: string | null;
  external_session_id?: string | null;
  last_response_id?: string | null;
}

export interface ChatMessage {
  row_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: unknown;
  created_at?: string;
  thread_row_id?: string;
}

export interface ToolActivity {
  name: string;
  args?: Record<string, unknown>;
  status: 'running' | 'complete';
}

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export interface StreamProgress {
  type: string;
  message?: string;
}

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
}

export interface SendMessageOptions {
  model?: string | null;
  reasoningEffort?: string;
}
