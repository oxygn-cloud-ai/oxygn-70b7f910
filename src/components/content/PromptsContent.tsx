import React, { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  Settings,
  Variable,
  MessageSquare,
  Play,
  Workflow,
  Loader2,
  StopCircle,
  PanelLeftOpen,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import ErrorBoundary from '@/components/ErrorBoundary';

// Import tab components
import { PromptFieldsTab, VariablesTab, ConversationTab, TemplatesTab } from '@/components/tabs';
import SettingsAccordion from '@/components/SettingsAccordion';
import ActionNodeSettings from '@/components/ActionNodeSettings';
import QuestionNodeSettings from '@/components/QuestionNodeSettings';

// Types
import type { Database } from '@/integrations/supabase/types';

// ========================
// Type Definitions
// ========================

type PromptRow = Database['public']['Tables']['q_prompts']['Row'];

interface VariableData {
  row_id: string;
  variable_name: string | null;
  variable_value: string | null;
  variable_description: string | null;
  default_value: string | null;
  is_required: boolean | null;
  source_type: string | null;
  source_question: string | null;
}

interface ModelData {
  row_id: string;
  model_id: string | null;
  model_name: string | null;
  provider?: string | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  is_active?: boolean | null;
}

interface SchemaData {
  row_id: string;
  schema_name: string;
  schema_description?: string | null;
  json_schema?: unknown;
  category?: string | null;
}

interface RunProgress {
  current: number;
  total: number;
  currentPromptName?: string;
  status?: 'running' | 'completed' | 'error';
}

interface ActionConfig {
  [key: string]: unknown;
}

interface QuestionConfig {
  question_text?: string;
  variable_name?: string;
  options?: Array<{ label: string; value: string }>;
  allow_multiple?: boolean;
  required?: boolean;
}

interface PromptsContentProps {
  // Selection state
  hasSelection?: boolean;
  selectedPromptId?: string | null;
  promptData?: Partial<PromptRow> | null;
  isLoadingPrompt?: boolean;
  
  // Field updates
  onUpdateField?: (field: string, value: unknown) => void;
  
  // Variables
  variables?: VariableData[];
  isLoadingVariables?: boolean;
  onAddVariable?: (data: Partial<VariableData>) => void;
  onUpdateVariable?: (rowId: string, data: Partial<VariableData>) => void;
  onDeleteVariable?: (rowId: string) => void;
  
  // Tree state
  selectedPromptHasChildren?: boolean;
  
  // Export
  onExport?: () => void;
  
  // Panel toggles
  onToggleConversation?: () => void;
  conversationPanelOpen?: boolean;
  onToggleFolderPanel?: () => void;
  folderPanelOpen?: boolean;
  onToggleReadingPane?: () => void;
  readingPaneOpen?: boolean;
  
  // Models and schemas
  models?: ModelData[];
  schemas?: SchemaData[];
  
  // Run handlers
  onRunPrompt?: (promptId: string) => void;
  onRunCascade?: (promptId: string) => void;
  isRunningPrompt?: boolean;
  isRunningCascade?: boolean;
  onCancelRun?: () => void;
  runProgress?: RunProgress | null;
  
  // Schema editing
  onEditSchema?: (schema: SchemaData) => void;
  
  // Cascade state
  isCascadeRunning?: boolean;
  singleRunPromptId?: string | null;
}

// ========================
// Tab Button Component
// ========================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label, badge }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`
          h-8 px-3 flex items-center gap-2 rounded-m3-sm text-body-sm font-medium transition-colors
          ${active 
            ? 'bg-primary/10 text-primary' 
            : 'text-on-surface-variant hover:bg-surface-container'
          }
        `}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-secondary/20 text-secondary rounded-m3-full">
            {badge}
          </span>
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

// ========================
// Run Progress Component
// ========================

interface RunProgressDisplayProps {
  progress: RunProgress;
  onCancel?: () => void;
}

const RunProgressDisplay: React.FC<RunProgressDisplayProps> = ({ progress, onCancel }) => {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-surface-container-low rounded-m3-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] text-on-surface-variant mb-1">
          <span className="truncate">{progress.currentPromptName || 'Running...'}</span>
          <span>{progress.current} / {progress.total}</span>
        </div>
        <Progress value={percentage} className="h-1" />
      </div>
      {onCancel && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container hover:text-error"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Cancel</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

// ========================
// Main PromptsContent Component
// ========================

const PromptsContent: React.FC<PromptsContentProps> = ({
  hasSelection = true,
  selectedPromptId,
  promptData,
  isLoadingPrompt = false,
  onUpdateField,
  variables = [],
  isLoadingVariables = false,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  selectedPromptHasChildren = false,
  onExport,
  onToggleConversation,
  conversationPanelOpen = true,
  onToggleFolderPanel,
  folderPanelOpen = true,
  onToggleReadingPane,
  readingPaneOpen = true,
  models = [],
  schemas = [],
  onRunPrompt,
  onRunCascade,
  isRunningPrompt = false,
  isRunningCascade = false,
  onCancelRun,
  runProgress,
  onEditSchema,
  isCascadeRunning = false,
  singleRunPromptId,
}) => {
  // Local state
  const [activeTab, setActiveTab] = useState<'fields' | 'variables' | 'conversation' | 'settings'>('fields');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  
  // Derived state
  const isRunning = isRunningPrompt || isRunningCascade;
  const isThisPromptRunning = singleRunPromptId === selectedPromptId;
  const promptName = promptData?.prompt_name || 'Untitled';
  const nodeType = promptData?.node_type || 'prompt';
  const isQuestionNode = nodeType === 'question';
  const isTopLevel = !promptData?.parent_row_id;
  const variableCount = variables?.length || 0;
  
  // Handlers
  const handleRunPrompt = useCallback(() => {
    if (selectedPromptId && onRunPrompt) {
      onRunPrompt(selectedPromptId);
    }
  }, [selectedPromptId, onRunPrompt]);
  
  const handleRunCascade = useCallback(() => {
    if (selectedPromptId && onRunCascade) {
      onRunCascade(selectedPromptId);
    }
  }, [selectedPromptId, onRunCascade]);
  
  const handleActionChange = useCallback((actionId: string | null, config: ActionConfig | null) => {
    if (onUpdateField) {
      onUpdateField('post_action', actionId);
      onUpdateField('post_action_config', config);
    }
  }, [onUpdateField]);
  
  const handleQuestionConfigChange = useCallback((config: QuestionConfig) => {
    if (onUpdateField) {
      onUpdateField('question_config', config);
    }
  }, [onUpdateField]);
  
  // Loading state
  if (isLoadingPrompt) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-body-sm">Loading prompt...</p>
        </div>
      </div>
    );
  }
  
  // No selection state (should be handled by parent, but fallback)
  if (!hasSelection || !promptData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-body-md">Select a prompt to view</p>
          <p className="text-label-md mt-1">or create a new one</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant shrink-0">
        {/* Left: Panel toggle + title */}
        <div className="flex items-center gap-3 min-w-0">
          {!folderPanelOpen && onToggleFolderPanel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleFolderPanel}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show folders</TooltipContent>
            </Tooltip>
          )}
          <FileText className="h-5 w-5 text-on-surface-variant shrink-0" />
          <h2 className="text-title-sm text-on-surface font-medium truncate">{promptName}</h2>
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Run buttons */}
          {!isRunning && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRunPrompt}
                    disabled={isCascadeRunning}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Run prompt</TooltipContent>
              </Tooltip>
              
              {selectedPromptHasChildren && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleRunCascade}
                      disabled={isCascadeRunning}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Workflow className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Run cascade</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
          
          {/* Running indicator */}
          {isThisPromptRunning && (
            <div className="flex items-center gap-2 px-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-[10px] text-primary">Running...</span>
            </div>
          )}
          
          {/* Settings toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className={`w-8 h-8 flex items-center justify-center rounded-m3-full transition-colors ${
                  settingsExpanded ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {settingsExpanded ? <ChevronUp className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">
              {settingsExpanded ? 'Hide settings' : 'Show settings'}
            </TooltipContent>
          </Tooltip>
          
          {/* Conversation panel toggle */}
          {!conversationPanelOpen && onToggleConversation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleConversation}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show chat</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      
      {/* Run progress */}
      {runProgress && (
        <div className="px-4 py-2 border-b border-outline-variant">
          <RunProgressDisplay progress={runProgress} onCancel={onCancelRun} />
        </div>
      )}
      
      {/* Settings accordion (collapsed by default) */}
      {settingsExpanded && (
        <div className="border-b border-outline-variant">
          <ErrorBoundary message="Settings failed to load">
            <SettingsAccordion
              promptData={promptData}
              onUpdateField={onUpdateField}
              models={models}
              schemas={schemas}
              onEditSchema={onEditSchema}
            />
          </ErrorBoundary>
        </div>
      )}
      
      {/* Tab navigation */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant">
        <TabButton
          active={activeTab === 'fields'}
          onClick={() => setActiveTab('fields')}
          icon={FileText}
          label="Fields"
        />
        <TabButton
          active={activeTab === 'variables'}
          onClick={() => setActiveTab('variables')}
          icon={Variable}
          label="Variables"
          badge={variableCount}
        />
        <TabButton
          active={activeTab === 'conversation'}
          onClick={() => setActiveTab('conversation')}
          icon={MessageSquare}
          label="Conversation"
        />
      </div>
      
      {/* Tab content */}
      <div className="flex-1 overflow-auto min-h-0">
        <ErrorBoundary message="Tab content failed to load">
          {activeTab === 'fields' && (
            <div className="p-4 space-y-4">
              <PromptFieldsTab
                selectedItemData={promptData}
                projectRowId={selectedPromptId || null}
                onUpdateField={onUpdateField}
                isTopLevel={isTopLevel}
                parentAssistantRowId={promptData?.parent_row_id || null}
              />
              
              {/* Question node settings */}
              {isQuestionNode && (
                <QuestionNodeSettings
                  config={(promptData?.question_config as QuestionConfig) || null}
                  onChange={handleQuestionConfigChange}
                  promptRowId={selectedPromptId || undefined}
                />
              )}
              
              {/* Action settings */}
              <ActionNodeSettings
                config={(promptData?.post_action_config as ActionConfig) || null}
                actionId={promptData?.post_action || null}
                onChange={handleActionChange}
                promptRowId={selectedPromptId || undefined}
                nodeType={nodeType}
              />
            </div>
          )}
          
          {activeTab === 'variables' && (
            <div className="p-4">
              <VariablesTab
                promptRowId={selectedPromptId || ''}
                variables={variables}
                isLoading={isLoadingVariables}
                onAdd={onAddVariable}
                onUpdate={onUpdateVariable}
                onDelete={onDeleteVariable}
                selectedItemData={promptData}
              />
            </div>
          )}
          
          {activeTab === 'conversation' && selectedPromptId && (
            <div className="p-4">
              <ConversationTab
                promptRowId={selectedPromptId}
                selectedItemData={promptData}
              />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default PromptsContent;
