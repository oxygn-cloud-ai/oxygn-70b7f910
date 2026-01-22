/**
 * Cascade Types
 * Type definitions for cascade execution and progress tracking
 */

import type { PromptData, TokenUsage } from './prompt.types';

/**
 * Cascade execution progress
 */
export interface CascadeProgress {
  currentLevel: number;
  totalLevels: number;
  currentPromptIndex: number;
  totalPrompts: number;
  currentPromptName: string;
  currentPromptRowId: string | null;
}

/**
 * Completed prompt in a cascade
 */
export interface CompletedPrompt {
  promptRowId: string;
  promptName: string;
  response: string;
  usage?: TokenUsage;
  latency_ms?: number;
}

/**
 * Skipped prompt in a cascade
 */
export interface SkippedPrompt {
  promptRowId: string;
  promptName: string;
  reason: SkipReason;
}

/**
 * Reasons for skipping a prompt
 */
export type SkipReason = 
  | 'excluded_from_cascade'
  | 'is_assistant'
  | 'no_content'
  | 'user_skipped'
  | 'parent_failed';

/**
 * Error actions user can take
 */
export type ErrorAction = 'retry' | 'skip' | 'stop';

/**
 * Cascade state
 */
export interface CascadeState {
  isRunning: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  progress: CascadeProgress | null;
  completedPrompts: CompletedPrompt[];
  skippedPrompts: SkippedPrompt[];
  errors: CascadeError[];
  startTime: number | null;
  endTime: number | null;
}

/**
 * Cascade error
 */
export interface CascadeError {
  promptRowId: string;
  promptName: string;
  errorMessage: string;
  errorCode?: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Cascade level with prompts
 */
export interface CascadeLevel {
  level: number;
  prompts: PromptData[];
}

/**
 * Cascade hierarchy
 */
export interface CascadeHierarchy {
  levels: CascadeLevel[];
  totalPrompts: number;
  totalLevels: number;
}

/**
 * Question node data
 */
export interface QuestionData {
  promptRowId: string;
  promptName: string;
  question: string;
  inputType?: 'text' | 'textarea' | 'select';
  options?: string[];
  required?: boolean;
}

/**
 * Collected question variable
 */
export interface CollectedQuestionVar {
  name: string;
  value: string;
  promptRowId: string;
}

/**
 * Action preview data
 */
export interface ActionPreviewData {
  promptRowId: string;
  promptName: string;
  actionId: string;
  actionName: string;
  itemCount: number;
  items: unknown[];
  config: Record<string, unknown>;
}

/**
 * Cascade run options
 */
export interface CascadeRunOptions {
  startFromPromptId?: string;
  skipConfirmations?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (progress: CascadeProgress) => void;
  onComplete?: (result: CascadeResult) => void;
  onError?: (error: CascadeError) => void;
}

/**
 * Cascade run result
 */
export interface CascadeResult {
  success: boolean;
  completedCount: number;
  skippedCount: number;
  errorCount: number;
  totalDuration: number;
  completedPrompts: CompletedPrompt[];
  skippedPrompts: SkippedPrompt[];
  errors: CascadeError[];
}

/**
 * Cascade context value (for CascadeRunContext)
 */
export interface CascadeContextValue {
  // State
  isRunning: boolean;
  isPaused: boolean;
  progress: CascadeProgress | null;
  completedPrompts: CompletedPrompt[];
  skippedPrompts: SkippedPrompt[];
  
  // Actions
  startCascade: (levels: CascadeLevel[], promptCount: number, skippedCount?: number) => void;
  updateProgress: (level: number, promptName: string, promptIndex: number, promptRowId?: string | null) => void;
  markPromptComplete: (promptRowId: string, promptName: string, response: string) => void;
  completeCascade: () => void;
  cancel: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  isCancelled: () => boolean;
  checkPaused: () => Promise<void>;
  
  // Error handling
  showError: (promptData: PromptData, errorMessage: string) => Promise<ErrorAction>;
  resolveError: (action: ErrorAction) => void;
  
  // Action preview
  showActionPreview: (previewData: ActionPreviewData) => Promise<boolean>;
  resolveActionPreview: (confirmed: boolean) => void;
  
  // Question handling
  showQuestion: (questionData: QuestionData) => Promise<string>;
  resolveQuestion: (answer: string) => void;
  addCollectedQuestionVar: (name: string, value: string) => void;
  resetQuestionState: () => void;
  collectedQuestionVars: CollectedQuestionVar[];
  
  // Single run mode
  singleRunPromptId: string | null;
  startSingleRun: (promptRowId: string) => void;
  endSingleRun: () => void;
}
