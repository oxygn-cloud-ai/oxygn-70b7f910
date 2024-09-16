import React, { useState, useEffect } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAICall } from '../hooks/useOpenAICall';
import PromptField from './PromptField';
import SettingsPanel from './SettingsPanel';
import ParentPromptPopup from './ParentPromptPopup';
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const ProjectPanels = ({ selectedItemData, projectRowId, onUpdateField }) => {
  const [localData, setLocalData] = useState(selectedItemData || {});
  const { models } = useOpenAIModels();
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { callOpenAI } = useOpenAICall();
  const [timer, setTimer] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(selectedItemData?.prompt_settings_open ?? true);
  const [isParentPopupOpen, setIsParentPopupOpen] = useState(false);
  const [parentData, setParentData] = useState(null);

  useEffect(() => {
    setLocalData(selectedItemData || {});
    setIsSettingsOpen(selectedItemData?.prompt_settings_open ?? true);
  }, [selectedItemData]);

  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => setTimer(prevTimer => prevTimer + 1), 1000);
    } else {
      clearInterval(interval);
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleSave = async (fieldName) => {
    await onUpdateField(fieldName, localData[fieldName]);
  };

  const handleChange = (fieldName, value) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
  };

  const handleReset = (fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: selectedItemData[fieldName] }));
  };

  const handleCheckChange = async (fieldName, newValue) => {
    const updatedValue = newValue ? true : false;
    setLocalData(prevData => ({ ...prevData, [`${fieldName}_on`]: updatedValue }));
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ [`${fieldName}_on`]: updatedValue })
        .eq('row_id', projectRowId);
      if (error) throw error;
    } catch (error) {
      console.error(`Error updating ${fieldName}_on:`, error);
    }
  };

  const handleGenerate = async () => {
    if (!settings || !settings.openai_api_key || !settings.openai_url) {
      console.error('OpenAI settings are not configured');
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();

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
      const endTime = Date.now();
      console.log(`API call completed in ${(endTime - startTime) / 1000} seconds`);
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

  const handleParentButtonHover = async () => {
    if (selectedItemData.parent_row_id) {
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('row_id', selectedItemData.parent_row_id)
          .single();

        if (error) throw error;
        setParentData(data);
        setIsParentPopupOpen(true);
      } catch (error) {
        console.error('Error fetching parent data:', error);
        toast.error('Failed to fetch parent data');
      }
    }
  };

  const renderPromptFields = () => {
    const fields = [
      { name: 'admin_prompt_result', label: 'Admin Result' },
      { name: 'user_prompt_result', label: 'User Result' },
      { name: 'input_admin_prompt', label: 'Input Admin Prompt' },
      { name: 'input_user_prompt', label: 'Input User Prompt' },
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
        initialValue={selectedItemData[field.name] || ''}
      />
    ));
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleGenerate}
          className="self-start mb-2"
          disabled={isGenerating}
        >
          {isGenerating ? `Generating... (${timer}s)` : 'Generate'}
        </Button>
        <Button
          variant="outline"
          className="self-start mb-2"
          disabled={!selectedItemData.parent_row_id}
          onMouseEnter={handleParentButtonHover}
          onMouseLeave={() => setIsParentPopupOpen(false)}
        >
          Parent
        </Button>
      </div>
      <div className="space-y-6">
        {renderPromptFields()}
      </div>
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
            handleCheckChange={handleCheckChange}
          />
        </CollapsibleContent>
      </Collapsible>
      {isParentPopupOpen && parentData && (
        <ParentPromptPopup
          adminPrompt={parentData.input_admin_prompt}
          userPromptResult={parentData.user_prompt_result}
          onClose={() => setIsParentPopupOpen(false)}
        />
      )}
    </div>
  );
};

export default ProjectPanels;
