import React, { useState, useEffect } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAICall } from '../hooks/useOpenAICall';
import { useTimer } from '../hooks/useTimer';
import PromptField from './PromptField';
import SettingsPanel from './SettingsPanel';
import ParentPromptPopup from './ParentPromptPopup';
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import useTreeData from '../hooks/useTreeData';

const ProjectPanels = ({ selectedItemData, projectRowId, onUpdateField }) => {
  const [localData, setLocalData] = useState(selectedItemData || {});
  const { models } = useOpenAIModels();
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { callOpenAI } = useOpenAICall();
  const [isGenerating, setIsGenerating] = useState(false);
  const formattedTime = useTimer(isGenerating);
  const [isSettingsOpen, setIsSettingsOpen] = useState(selectedItemData?.prompt_settings_open ?? true);
  const [isParentPopupOpen, setIsParentPopupOpen] = useState(false);
  const [parentData, setParentData] = useState(null);
  const [cascadeField, setCascadeField] = useState(null);
  const { treeData } = useTreeData(supabase);

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
    if (selectedItemData.parent_row_id) {
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('prompt_name, input_admin_prompt, input_user_prompt, admin_prompt_result, user_prompt_result')
          .eq('row_id', selectedItemData.parent_row_id)
          .single();

        if (error) throw error;
        setParentData(data);
        setCascadeField(fieldName);
        setIsParentPopupOpen(true);
      } catch (error) {
        console.error('Error fetching parent data:', error);
        toast.error('Failed to fetch parent data');
      }
    } else {
      toast.error('No parent prompt available for cascade');
    }
  };

  const handleCascadeAction = (content, action) => {
    if (cascadeField) {
      const newContent = action === 'append'
        ? (localData[cascadeField] || '') + '\n' + content
        : content;
      handleChange(cascadeField, newContent);
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
        onCascade={() => handleCascade(field.name)}
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
          className={`self-start mb-2 ${isGenerating ? 'text-green-700' : ''}`}
          disabled={isGenerating}
        >
          {isGenerating ? `Generating... (${formattedTime})` : 'Generate'}
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
          />
        </CollapsibleContent>
      </Collapsible>
      {isParentPopupOpen && parentData && (
        <ParentPromptPopup
          isOpen={isParentPopupOpen}
          onClose={() => {
            setIsParentPopupOpen(false);
            setCascadeField(null);
          }}
          parentData={parentData}
          cascadeField={cascadeField}
          onCascade={handleCascadeAction}
          treeData={treeData}
        />
      )}
    </div>
  );
};

export default ProjectPanels;
