import React from "react";
import { FileText, PanelRightOpen, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  PromptsContent,
  TemplatesContent,
  SettingsContent,
  HealthContent,
} from "@/components/content";
import type { NavId } from "@/types/layout.types";

/**
 * Prompt data structure
 */
interface PromptData {
  row_id: string;
  prompt_name?: string;
  input_admin_prompt?: string;
  input_user_prompt?: string;
  output_response?: string;
  model?: string;
  [key: string]: unknown;
}

/**
 * Variable data structure
 */
interface VariableData {
  row_id: string;
  variable_name?: string;
  variable_value?: string;
  default_value?: string;
  [key: string]: unknown;
}

/**
 * Template data structure
 */
interface TemplateData {
  row_id?: string;
  id?: string;
  template_name?: string;
  [key: string]: unknown;
}

/**
 * Schema data structure
 */
interface SchemaData {
  row_id: string;
  schema_name?: string;
  json_schema?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Model data structure
 */
interface ModelData {
  row_id: string;
  model_id?: string;
  model_name?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

/**
 * Settings data structure
 */
interface SettingsData {
  [key: string]: unknown;
}

/**
 * Cost tracking data structure
 */
interface CostTrackingData {
  totalCost?: number;
  dailyCost?: number;
  [key: string]: unknown;
}

/**
 * Conversation tool defaults structure
 */
interface ConversationToolDefaults {
  file_search_enabled?: boolean;
  code_interpreter_enabled?: boolean;
  function_calling_enabled?: boolean;
  [key: string]: unknown;
}

/**
 * Run progress data structure
 */
interface RunProgress {
  current?: number;
  total?: number;
  currentPromptName?: string;
  [key: string]: unknown;
}

/**
 * Templates hook interface
 */
interface TemplatesHook {
  templates?: TemplateData[];
  isLoading?: boolean;
  fetchTemplates?: () => Promise<void>;
  [key: string]: unknown;
}

/**
 * JSON Schema templates hook interface
 */
interface JsonSchemaTemplatesHook {
  templates?: SchemaData[];
  isLoading?: boolean;
  fetchTemplates?: () => Promise<void>;
  [key: string]: unknown;
}

/**
 * Prompt library item structure
 */
interface PromptLibraryItem {
  row_id: string;
  name: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * ReadingPane component props
 */
interface ReadingPaneProps {
  hasSelection?: boolean;
  selectedPromptId?: string | null;
  promptData?: PromptData | null;
  isLoadingPrompt?: boolean;
  onUpdateField?: (fieldName: string, value: unknown) => void;
  variables?: VariableData[];
  isLoadingVariables?: boolean;
  onAddVariable?: () => void;
  onUpdateVariable?: (rowId: string, field: string, value: unknown) => void;
  onDeleteVariable?: (rowId: string) => void;
  selectedPromptHasChildren?: boolean;
  onExport?: (promptId: string) => void;
  activeNav?: NavId;
  activeSubItem?: string | null;
  selectedTemplate?: TemplateData | null;
  activeTemplateTab?: string;
  onToggleConversation?: () => void;
  conversationPanelOpen?: boolean;
  onToggleFolderPanel?: () => void;
  folderPanelOpen?: boolean;
  onToggleReadingPane?: () => void;
  // Run prompt handlers
  onRunPrompt?: (promptId: string) => void;
  onRunCascade?: (promptId: string) => void;
  isRunningPrompt?: boolean;
  isRunningCascade?: boolean;
  onCancelRun?: () => void;
  runProgress?: RunProgress;
  // Cascade lock
  isCascadeRunning?: boolean;
  singleRunPromptId?: string | null;
  // Settings props
  settings?: SettingsData;
  isLoadingSettings?: boolean;
  onUpdateSetting?: (key: string, value: unknown) => void;
  models?: ModelData[];
  isLoadingModels?: boolean;
  onToggleModel?: (rowId: string) => void;
  onAddModel?: (data: Record<string, unknown>) => Promise<void>;
  onUpdateModel?: (rowId: string, data: Record<string, unknown>) => Promise<void>;
  onDeleteModel?: (rowId: string) => Promise<void>;
  onAddModels?: (models: Record<string, unknown>[]) => Promise<void>;
  // Cost analytics and conversation defaults
  costTracking?: CostTrackingData;
  conversationToolDefaults?: ConversationToolDefaults;
  // Prompt library for templates
  promptLibrary?: PromptLibraryItem[];
  // Templates props
  templatesHook?: TemplatesHook;
  jsonSchemaTemplatesHook?: JsonSchemaTemplatesHook;
  onEditSchema?: (schemaId: string) => void;
}

/**
 * ReadingPane component
 * Main content area that displays prompts, settings, health, or templates
 */
const ReadingPane: React.FC<ReadingPaneProps> = ({ 
  hasSelection = true, 
  selectedPromptId,
  promptData,
  isLoadingPrompt,
  onUpdateField,
  variables,
  isLoadingVariables,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  selectedPromptHasChildren = false,
  onExport, 
  activeNav = "prompts", 
  activeSubItem = null, 
  selectedTemplate = null,
  activeTemplateTab = "prompts",
  onToggleConversation, 
  conversationPanelOpen = true,
  onToggleFolderPanel,
  folderPanelOpen = true,
  onToggleReadingPane,
  // Run prompt handlers
  onRunPrompt,
  onRunCascade,
  isRunningPrompt = false,
  isRunningCascade = false,
  onCancelRun,
  runProgress,
  // Cascade lock
  isCascadeRunning = false,
  singleRunPromptId = null,
  // Settings props
  settings = {},
  isLoadingSettings = false,
  onUpdateSetting,
  models = [],
  isLoadingModels = false,
  onToggleModel,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  onAddModels,
  // Cost analytics and conversation defaults
  costTracking,
  conversationToolDefaults,
  // Prompt library for templates
  promptLibrary,
  // Templates props
  templatesHook,
  jsonSchemaTemplatesHook,
  onEditSchema,
}) => {

  // Settings mode
  if (activeNav === "settings") {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        <ErrorBoundary message="Settings encountered an error.">
          <SettingsContent 
            activeSubItem={activeSubItem}
            settings={settings}
            isLoadingSettings={isLoadingSettings}
            onUpdateSetting={onUpdateSetting}
            models={models}
            isLoadingModels={isLoadingModels}
            onToggleModel={onToggleModel}
            onAddModel={onAddModel}
            onUpdateModel={onUpdateModel}
            onDeleteModel={onDeleteModel}
            onAddModels={onAddModels}
            costTracking={costTracking}
            conversationToolDefaults={conversationToolDefaults}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Health mode
  if (activeNav === "health") {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        <ErrorBoundary message="Health check encountered an error.">
          <HealthContent activeSubItem={activeSubItem} />
        </ErrorBoundary>
      </div>
    );
  }

  // Templates mode
  if (activeNav === "templates") {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        <ErrorBoundary message="Templates encountered an error.">
          <TemplatesContent 
            selectedTemplate={selectedTemplate}
            activeTemplateTab={activeTemplateTab}
            templatesHook={templatesHook}
            jsonSchemaTemplatesHook={jsonSchemaTemplatesHook}
            models={models}
            onTemplateChange={(template: TemplateData) => {
              // Refresh templates list when template changes
              if (templatesHook?.fetchTemplates) templatesHook.fetchTemplates();
              if (jsonSchemaTemplatesHook?.fetchTemplates) jsonSchemaTemplatesHook.fetchTemplates();
            }}
            folderPanelOpen={folderPanelOpen}
            onToggleFolderPanel={onToggleFolderPanel}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Prompts mode (default) - no selection
  if (!hasSelection) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        {/* Header with toggle buttons */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0">
          {/* Left - Show folder panel when hidden */}
          <div>
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
          </div>
          {/* Right - Show conversation panel when hidden */}
          <div>
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-on-surface-variant">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-body-md">Select a prompt to view</p>
            <p className="text-label-md mt-1">or create a new one</p>
          </div>
        </div>
      </div>
    );
  }

  // Prompts mode with selection
  return (
    <PromptsContent
      hasSelection={hasSelection}
      selectedPromptId={selectedPromptId}
      promptData={promptData}
      isLoadingPrompt={isLoadingPrompt}
      onUpdateField={onUpdateField}
      variables={variables}
      isLoadingVariables={isLoadingVariables}
      onAddVariable={onAddVariable}
      onUpdateVariable={onUpdateVariable}
      onDeleteVariable={onDeleteVariable}
      selectedPromptHasChildren={selectedPromptHasChildren}
      onExport={onExport}
      onToggleConversation={onToggleConversation}
      conversationPanelOpen={conversationPanelOpen}
      onToggleFolderPanel={onToggleFolderPanel}
      folderPanelOpen={folderPanelOpen}
      onToggleReadingPane={onToggleReadingPane}
      readingPaneOpen={true}
      models={models}
      schemas={jsonSchemaTemplatesHook?.templates || []}
      onRunPrompt={onRunPrompt}
      onRunCascade={onRunCascade}
      isRunningPrompt={isRunningPrompt}
      isRunningCascade={isRunningCascade}
      onCancelRun={onCancelRun}
      runProgress={runProgress}
      onEditSchema={onEditSchema}
      isCascadeRunning={isCascadeRunning}
      singleRunPromptId={singleRunPromptId}
    />
  );
};

export default ReadingPane;
