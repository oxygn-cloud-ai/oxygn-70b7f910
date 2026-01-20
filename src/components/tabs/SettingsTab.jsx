import React from 'react';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { useProjectData } from '../../hooks/useProjectData';
import SettingsPanel from '../SettingsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkipForward, Upload, Zap, AlertTriangle, MessageCircleQuestion } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ActionNodeSettings from '../ActionNodeSettings';
import QuestionNodeSettings from '../QuestionNodeSettings';

const SettingsTab = ({ selectedItemData, projectRowId }) => {
  const { models } = useOpenAIModels();
  
  const {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  } = useProjectData(selectedItemData, projectRowId);

  // Determine if this is a top-level prompt (no parent)
  const isTopLevel = !selectedItemData?.parent_row_id;

  const handleExcludeFromCascadeChange = (checked) => {
    handleChange('exclude_from_cascade', checked);
    handleSave('exclude_from_cascade', checked);
  };

  const handleExcludeFromExportChange = (checked) => {
    handleChange('exclude_from_export', checked);
    handleSave('exclude_from_export', checked);
  };

  const handleNodeTypeChange = (value) => {
    handleChange('node_type', value);
    handleSave('node_type', value);
    
    if (value === 'action') {
      // Only set default structured output if not already configured
      if (!localData.response_format_on) {
        const structuredFormat = JSON.stringify({
          type: 'json_schema',
          json_schema: {
            name: 'action_response',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      content: { type: 'string' }
                    },
                    required: ['name', 'content'],
                    additionalProperties: false
                  }
                }
              },
              required: ['items'],
              additionalProperties: false
            }
          }
        });
        handleChange('response_format', structuredFormat);
        handleChange('response_format_on', true);
        handleSave('response_format', structuredFormat);
        handleSave('response_format_on', true);
      }
      // Clear question config
      handleChange('question_config', null);
      handleSave('question_config', null);
    } else if (value === 'question') {
      // Set default question config
      const defaultConfig = { max_questions: 10, completion_mode: 'ai_decides', show_progress: true };
      handleChange('question_config', defaultConfig);
      handleSave('question_config', defaultConfig);
      // Clear action fields
      handleChange('post_action', null);
      handleChange('post_action_config', null);
      handleChange('json_schema_template_id', null);
      handleChange('extracted_variables', null);
      handleChange('last_action_result', null);
      handleChange('response_format_on', false);
      handleSave('post_action', null);
      handleSave('post_action_config', null);
      handleSave('json_schema_template_id', null);
      handleSave('extracted_variables', null);
      handleSave('last_action_result', null);
      handleSave('response_format_on', false);
    } else {
      // CRITICAL: Clear ALL action-related fields when switching to standard
      // This prevents "standard node with post_action configured" state
      handleChange('post_action', null);
      handleChange('post_action_config', null);
      handleChange('json_schema_template_id', null);
      handleChange('extracted_variables', null);
      handleChange('last_action_result', null);
      handleChange('response_format_on', false);
      handleChange('question_config', null);
      
      handleSave('post_action', null);
      handleSave('post_action_config', null);
      handleSave('json_schema_template_id', null);
      handleSave('extracted_variables', null);
      handleSave('last_action_result', null);
      handleSave('response_format_on', false);
      handleSave('question_config', null);
    }
  };

  // Auto-fix handler for inconsistent state (post_action exists but node_type != 'action')
  const handleAutoFixNodeType = () => {
    handleChange('node_type', 'action');
    handleSave('node_type', 'action');
  };

  // Auto-fix handler for orphaned question_config
  const handleAutoFixQuestionType = () => {
    handleChange('node_type', 'question');
    handleSave('node_type', 'question');
  };

  const handleQuestionConfigChange = (newConfig) => {
    handleChange('question_config', newConfig);
    handleSave('question_config', newConfig);
  };

  const isActionNode = localData.node_type === 'action';
  const isQuestionNode = localData.node_type === 'question';
  const hasOrphanedPostAction = !!localData.post_action && localData.node_type !== 'action';
  const hasOrphanedQuestionConfig = !!localData.question_config && localData.node_type !== 'question';

  // Compact toggle row for top-level prompts
  const CompactToggles = () => (
    <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-m3-md border border-outline-variant mb-4">
      {/* Auto-fix warning icon for orphaned post_action */}
      {hasOrphanedPostAction && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              onClick={handleAutoFixNodeType}
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-[10px]">Post-action configured but not an action node. Click to fix.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Auto-fix warning icon for orphaned question_config */}
      {hasOrphanedQuestionConfig && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
              onClick={handleAutoFixQuestionType}
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-[10px]">Question config set but not a question node. Click to fix.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Node Type Toggle - M3 compliant icon button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => handleNodeTypeChange(isActionNode ? 'standard' : 'action')}
          >
            <Zap className={`h-4 w-4 ${isActionNode ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{isActionNode ? 'Action prompt (click to disable)' : 'Enable action prompt'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Question Node Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => handleNodeTypeChange(isQuestionNode ? 'standard' : 'question')}
          >
            <MessageCircleQuestion className={`h-4 w-4 ${isQuestionNode ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{isQuestionNode ? 'Question prompt (click to disable)' : 'Enable question prompt'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Exclude from Cascade Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => handleExcludeFromCascadeChange(!localData.exclude_from_cascade)}
          >
            <SkipForward className={`h-4 w-4 ${localData.exclude_from_cascade ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{localData.exclude_from_cascade ? 'Excluded from cascade (click to include)' : 'Included in cascade (click to exclude)'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Exclude from Export Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
            onClick={() => handleExcludeFromExportChange(!localData.exclude_from_export)}
          >
            <Upload className={`h-4 w-4 ${localData.exclude_from_export ? 'text-primary' : 'text-on-surface-variant'}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-[10px]">{localData.exclude_from_export ? 'Excluded from export (click to include)' : 'Included in export (click to exclude)'}</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-5 w-px bg-outline-variant mx-1" />
      
      <span className="text-[10px] text-on-surface-variant">
        {(hasOrphanedPostAction || hasOrphanedQuestionConfig) && <span className="text-amber-500">Needs fix · </span>}
        {isActionNode && 'Action'}
        {isQuestionNode && 'Question'}
        {localData.exclude_from_cascade && ((isActionNode || isQuestionNode) ? ' · ' : '') + 'Skip cascade'}
        {localData.exclude_from_export && ((isActionNode || isQuestionNode || localData.exclude_from_cascade) ? ' · ' : '') + 'Skip export'}
        {!isActionNode && !isQuestionNode && !localData.exclude_from_cascade && !localData.exclude_from_export && !hasOrphanedPostAction && !hasOrphanedQuestionConfig && 'Standard prompt'}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {isTopLevel ? (
        <>
          {/* Compact toggles for top-level prompts */}
          <CompactToggles />
          
          {/* Action Node Settings (only shown for action nodes) */}
          {isActionNode && (
            <ActionNodeSettings
              localData={localData}
              handleChange={handleChange}
              handleSave={handleSave}
            />
          )}
          
          {/* Question Node Settings (only shown for question nodes) */}
          {isQuestionNode && (
            <QuestionNodeSettings
              config={localData.question_config}
              onChange={handleQuestionConfigChange}
            />
          )}
        </>
      ) : (
        <>
          {/* Compact toggles for child prompts - same as top-level */}
          <CompactToggles />
          
          {/* Action Node Settings (only shown for action nodes) */}
          {isActionNode && (
            <ActionNodeSettings
              localData={localData}
              handleChange={handleChange}
              handleSave={handleSave}
            />
          )}
          
          {/* Question Node Settings (only shown for question nodes) */}
          {isQuestionNode && (
            <QuestionNodeSettings
              config={localData.question_config}
              onChange={handleQuestionConfigChange}
            />
          )}
        </>
      )}

      {/* AI Model Settings */}
      <div className="mb-4">
        <h3 className="text-lg font-medium">AI Model Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the AI model and parameters for this prompt.
        </p>
      </div>
      
      <SettingsPanel
        localData={localData}
        selectedItemData={selectedItemData}
        models={models}
        handleChange={handleChange}
        handleSave={handleSave}
        handleReset={handleReset}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </div>
  );
};

export default SettingsTab;
