import React from 'react';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { useProjectData } from '../../hooks/useProjectData';
import SettingsPanel from '../SettingsPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkipForward, Upload, Zap, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ActionNodeSettings from '../ActionNodeSettings';

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
    
    // Auto-enable JSON mode for action nodes
    if (value === 'action') {
      handleChange('response_format', 'json_object');
      handleChange('response_format_on', true);
      handleSave('response_format', 'json_object');
      handleSave('response_format_on', true);
    }
  };

  const isActionNode = localData.node_type === 'action';

  // Compact toggle row for top-level prompts
  const CompactToggles = () => (
    <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border border-border/50 mb-4">
      {/* Node Type Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center h-8 w-8 rounded-md cursor-pointer transition-colors ${
              isActionNode 
                ? 'bg-amber-500/20 text-amber-500' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            onClick={() => handleNodeTypeChange(isActionNode ? 'standard' : 'action')}
          >
            <Zap className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{isActionNode ? 'Action node (click to make standard)' : 'Standard node (click to make action)'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Exclude from Cascade Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center h-8 w-8 rounded-md cursor-pointer transition-colors ${
              localData.exclude_from_cascade 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            onClick={() => handleExcludeFromCascadeChange(!localData.exclude_from_cascade)}
          >
            <SkipForward className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{localData.exclude_from_cascade ? 'Excluded from cascade (click to include)' : 'Included in cascade (click to exclude)'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Exclude from Export Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`flex items-center justify-center h-8 w-8 rounded-md cursor-pointer transition-colors ${
              localData.exclude_from_export 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
            onClick={() => handleExcludeFromExportChange(!localData.exclude_from_export)}
          >
            <Upload className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{localData.exclude_from_export ? 'Excluded from export (click to include)' : 'Included in export (click to exclude)'}</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-5 w-px bg-border mx-1" />
      
      <span className="text-xs text-muted-foreground">
        {isActionNode && 'Action'}
        {localData.exclude_from_cascade && (isActionNode ? ' · ' : '') + 'Skip cascade'}
        {localData.exclude_from_export && ((isActionNode || localData.exclude_from_cascade) ? ' · ' : '') + 'Skip export'}
        {!isActionNode && !localData.exclude_from_cascade && !localData.exclude_from_export && 'Standard settings'}
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
