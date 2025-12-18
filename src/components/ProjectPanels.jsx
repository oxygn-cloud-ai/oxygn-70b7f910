import React, { useState, useCallback, useMemo } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAICall } from '../hooks/useOpenAICall';
import { useTimer } from '../hooks/useTimer';
import { useProjectData } from '../hooks/useProjectData';
import { useAssistant } from '../hooks/useAssistant';
import PromptField from './PromptField';
import SettingsPanel from './SettingsPanel';
import AssistantPanel from './AssistantPanel';
import ChildPromptPanel from './ChildPromptPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Bot, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';

const ProjectPanels = ({ 
  selectedItemData, 
  projectRowId, 
  onUpdateField, 
  isLinksPage = false, 
  isReadOnly = false, 
  onCascade, 
  parentData, 
  cascadeField,
  isTopLevel = false,
  parentAssistantRowId = null,
}) => {
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { models } = useOpenAIModels();
  const { callOpenAI } = useOpenAICall();
  const [isGenerating, setIsGenerating] = useState(false);
  const formattedTime = useTimer(isGenerating);
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    selectedItemData?.prompt_settings_open ?? false
  );

  const {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  } = useProjectData(selectedItemData, projectRowId);

  const handleGenerate = useCallback(async () => {
    if (!settings) {
      toast.error('Settings are not configured. Please check your settings.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await callOpenAI(
        localData.input_admin_prompt,
        localData.input_user_prompt,
        localData,
        {
          onSuccess: async (content) => {
            if (supabase && projectRowId) {
              const { error } = await supabase
                .from(import.meta.env.VITE_PROMPTS_TBL)
                .update({ user_prompt_result: content })
                .eq('row_id', projectRowId);
              
              if (error) {
                console.error('Failed to save result:', error);
              }
            }
          },
        }
      );
      
      if (result) {
        handleChange('user_prompt_result', result);
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      toast.error(`Error generating response: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [settings, localData, callOpenAI, handleChange, supabase, projectRowId]);

  const handleSettingsToggle = useCallback(async (open) => {
    setIsSettingsOpen(open);
    if (supabase && projectRowId) {
      try {
        await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ prompt_settings_open: open })
          .eq('row_id', projectRowId);
      } catch (error) {
        console.error('Error updating prompt_settings_open:', error);
      }
    }
  }, [supabase, projectRowId]);

  const handleCascade = useCallback((fieldName) => {
    if (onCascade) {
      onCascade(fieldName);
    }
  }, [onCascade]);

  const fields = useMemo(() => [
    { name: 'input_admin_prompt', label: 'Input Admin Prompt' },
    { name: 'input_user_prompt', label: 'Input User Prompt' },
    { name: 'admin_prompt_result', label: 'Admin Result' },
    { name: 'user_prompt_result', label: 'User Result' },
    { name: 'note', label: 'Notes' }
  ], []);

  const { assistant } = useAssistant(selectedItemData?.is_assistant ? projectRowId : null);

  const handleEnableAssistant = useCallback(async () => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ is_assistant: true })
        .eq('row_id', projectRowId);
      
      if (error) throw error;
      
      if (onUpdateField) {
        onUpdateField('is_assistant', true);
      }
      toast.success('Assistant mode enabled');
    } catch (error) {
      console.error('Error enabling assistant mode:', error);
      toast.error('Failed to enable assistant mode');
    }
  }, [supabase, projectRowId, onUpdateField]);

  if (!selectedItemData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt data...</p>
      </div>
    );
  }

  // If this is a top-level prompt AND marked as an assistant, show AssistantPanel
  if (isTopLevel && selectedItemData.is_assistant) {
    return (
      <AssistantPanel
        promptRowId={projectRowId}
        selectedItemData={selectedItemData}
      />
    );
  }

  // If this is a child of an assistant, show ChildPromptPanel
  if (parentAssistantRowId) {
    return (
      <ChildPromptPanel
        selectedItemData={selectedItemData}
        projectRowId={projectRowId}
        parentAssistantRowId={parentAssistantRowId}
        onUpdateField={onUpdateField}
      />
    );
  }

  // Standard prompt view
  return (
    <div className="flex flex-col gap-4 h-full overflow-auto p-4">
      {/* Assistant Mode Toggle - only show for top-level prompts */}
      {isTopLevel && !isLinksPage && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <div className="p-1.5 rounded bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              Assistant Mode
            </CardTitle>
            <CardDescription className="text-xs">
              Convert this prompt into an OpenAI Assistant with persistent context and conversation threads.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              size="sm" 
              onClick={handleEnableAssistant}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Bot className="h-4 w-4 mr-2" />
              Enable Assistant Mode
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Prompt Fields */}
      <div className="space-y-4">
        {fields
          .filter(field => {
            if (field.name === 'admin_prompt_result') {
              return !!(localData.admin_prompt_result || selectedItemData?.admin_prompt_result);
            }
            return true;
          })
          .map(field => (
            <PromptField
              key={field.name}
              label={field.label}
              value={localData[field.name] || ''}
              onChange={(value) => handleChange(field.name, value)}
              onReset={() => handleReset(field.name)}
              onSave={() => handleSave(field.name)}
              initialValue={selectedItemData[field.name] || ''}
              onGenerate={isLinksPage ? null : handleGenerate}
              isGenerating={isGenerating}
              formattedTime={formattedTime}
              isLinksPage={isLinksPage}
              isReadOnly={isReadOnly}
              onCascade={() => handleCascade(field.name)}
              parentData={parentData}
              cascadeField={cascadeField}
              hasUnsavedChanges={hasUnsavedChanges(field.name)}
              promptId={projectRowId}
            />
          ))}
      </div>

      {/* Settings Section */}
      {!isLinksPage && (
        <Collapsible
          open={isSettingsOpen}
          onOpenChange={handleSettingsToggle}
          className="border border-border rounded-lg bg-card"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Prompt Settings</h3>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                {isSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-4">
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
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default ProjectPanels;
