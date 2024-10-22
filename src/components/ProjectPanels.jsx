import React, { useState, useCallback } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAICall } from '../hooks/useOpenAICall';
import { useTimer } from '../hooks/useTimer';
import { useProjectData } from '../hooks/useProjectData';
import PromptFields from './PromptFields';
import SettingsPanel from './SettingsPanel';
import TextHighlighter from './TextHighlighter';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

const ProjectPanels = ({ selectedItemData, projectRowId, onUpdateField, isLinksPage = false, isReadOnly = false, onCascade, parentData, cascadeField }) => {
  const { localData, handleChange, handleSave, handleReset, hasUnsavedChanges } = useProjectData(selectedItemData, projectRowId);
  const { models } = useOpenAIModels();
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { callOpenAI } = useOpenAICall();
  const [isGenerating, setIsGenerating] = useState(false);
  const formattedTime = useTimer(isGenerating);
  const [isSettingsOpen, setIsSettingsOpen] = useState(selectedItemData?.prompt_settings_open ?? true);
  const [isHighlighterOpen, setIsHighlighterOpen] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!settings || !settings.openai_api_key || !settings.openai_url) {
      console.error('OpenAI settings are not configured');
      toast.error('OpenAI settings are not configured. Please check your settings.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await callOpenAI(
        localData.input_admin_prompt,
        localData.input_user_prompt,
        localData
      );
      handleChange('user_prompt_result', result);
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      toast.error(`Error generating response: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [settings, localData, callOpenAI, handleChange]);

  const handleSettingsToggle = useCallback(async (open) => {
    setIsSettingsOpen(open);
    try {
      await supabase
        .from('prompts')
        .update({ prompt_settings_open: open })
        .eq('row_id', projectRowId);
    } catch (error) {
      console.error('Error updating prompt_settings_open:', error);
    }
  }, [supabase, projectRowId]);

  const handleCascade = useCallback((fieldName) => {
    if (onCascade) {
      onCascade(fieldName);
    } else {
      console.log(`Cascade clicked for field: ${fieldName}`);
    }
  }, [onCascade]);

  const handleHighlight = useCallback((highlights) => {
    handleChange('highlights', highlights);
  }, [handleChange]);

  const handleSourceInfoChange = useCallback((sourceInfo) => {
    handleChange('source_info', sourceInfo);
  }, [handleChange]);

  if (!selectedItemData) {
    return <div>Loading prompt data...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <PromptFields
        localData={localData}
        handleChange={handleChange}
        handleReset={handleReset}
        handleSave={handleSave}
        isLinksPage={isLinksPage}
        handleGenerate={handleGenerate}
        isGenerating={isGenerating}
        formattedTime={formattedTime}
        isReadOnly={isReadOnly}
        handleCascade={handleCascade}
        parentData={parentData}
        cascadeField={cascadeField}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      {!isLinksPage && (
        <>
          <Collapsible
            open={isSettingsOpen}
            onOpenChange={handleSettingsToggle}
            className="border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Prompt Settings</h3>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <SettingsPanel
                localData={localData}
                selectedItemData={selectedItemData}
                models={models}
                handleChange={handleChange}
                handleSave={handleSave}
                handleReset={handleReset}
                hasUnsavedChanges={hasUnsavedChanges}
              />
            </CollapsibleContent>
          </Collapsible>
          <Collapsible
            open={isHighlighterOpen}
            onOpenChange={setIsHighlighterOpen}
            className="border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Text Highlighter</h3>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isHighlighterOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <TextHighlighter
                text={localData.input_user_prompt || ''}
                highlights={localData.highlights || []}
                onHighlight={handleHighlight}
                sourceInfo={localData.source_info || {}}
                onSourceInfoChange={handleSourceInfoChange}
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
};

export default ProjectPanels;