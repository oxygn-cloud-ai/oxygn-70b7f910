import React, { useState, useEffect } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAICall } from '../hooks/useOpenAICall';
import { useTimer } from '../hooks/useTimer';
import PromptField from './PromptField';
import SettingsPanel from './SettingsPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

const ProjectPanels = ({ selectedItemData, projectRowId, onUpdateField, onCascade, isLinksPage = false, isReadOnly = false }) => {
  const [localData, setLocalData] = useState(selectedItemData || {});
  const { models } = useOpenAIModels();
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { callOpenAI } = useOpenAICall();
  const [isGenerating, setIsGenerating] = useState(false);
  const formattedTime = useTimer(isGenerating);
  const [isSettingsOpen, setIsSettingsOpen] = useState(selectedItemData?.prompt_settings_open ?? true);

  useEffect(() => {
    setLocalData(selectedItemData || {});
    setIsSettingsOpen(selectedItemData?.prompt_settings_open ?? true);
  }, [selectedItemData]);

  const handleSave = async (fieldName) => {
    await onUpdateField(fieldName, localData[fieldName]);
  };

  const handleChange = (fieldName, value) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
  };

  const handleReset = (fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: selectedItemData[fieldName] }));
  };

  const handleGenerate = async () => {
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
  };

  const handleSettingsToggle = async (open) => {
    setIsSettingsOpen(open);
    try {
      await supabase
        .from('prompts')
        .update({ prompt_settings_open: open })
        .eq('row_id', projectRowId);
    } catch (error) {
      console.error('Error updating prompt_settings_open:', error);
    }
  };

  const handleCascade = async (fieldName) => {
    if (typeof onCascade === 'function') {
      onCascade(fieldName, localData[fieldName]);
    } else {
      console.error('onCascade is not a function');
      toast.error('Unable to cascade: onCascade is not defined');
    }
  };

  const renderPromptFields = () => {
    if (!selectedItemData) {
      return <div>No prompt data available</div>;
    }

    const fields = [
      { name: 'input_admin_prompt', label: 'Input Admin Prompt' },
      { name: 'input_user_prompt', label: 'Input User Prompt' },
      { name: 'admin_prompt_result', label: 'Admin Result' },
      { name: 'user_prompt_result', label: 'User Result' },
      { name: 'note', label: 'Notes' }
    ];

    return fields.map(field => (
      <PromptField
        key={field.name}
        label={field.label}
        value={localData[field.name] || ''}
        onChange={(value) => handleChange(field.name, value)}
        onReset={() => handleReset(field.name)}
        onSave={() => handleSave(field.name)}
        onCascade={() => handleCascade(field.name)}
        initialValue={selectedItemData[field.name] || ''}
        onGenerate={isLinksPage ? null : handleGenerate}
        isGenerating={isGenerating}
        formattedTime={formattedTime}
        isLinksPage={isLinksPage}
        isReadOnly={isReadOnly}
      />
    ));
  };

  if (!selectedItemData) {
    return <div>Loading prompt data...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <div className="space-y-6">
        {renderPromptFields()}
      </div>
      {!isLinksPage && (
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
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default ProjectPanels;
