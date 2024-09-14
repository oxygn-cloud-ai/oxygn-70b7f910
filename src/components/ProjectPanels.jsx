import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSaveField } from '../hooks/useSaveField';
import { useFetchLatestData } from '../hooks/useFetchLatestData';

const TextAreaWithIcons = ({ placeholder, value, fieldName, onSave, onReset, readOnly }) => {
  const [text, setText] = useState(value || '');

  useEffect(() => {
    setText(value || '');
  }, [value]);

  const handleSave = () => {
    onSave(fieldName, text);
  };

  const handleReset = async () => {
    const resetValue = await onReset(fieldName);
    if (resetValue !== null) {
      setText(resetValue);
    }
  };

  return (
    <div className="relative mb-4">
      <div className="absolute top-2 left-2 z-10 flex space-x-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
          <Save className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Textarea 
        placeholder={placeholder} 
        className="w-full p-2 pl-16 border rounded" 
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  );
};

const ProjectPanels = ({ selectedItemData, projectRowId }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading } = useFetchLatestData(projectRowId);
  const [localData, setLocalData] = useState(selectedItemData || {});

  useEffect(() => {
    setLocalData(selectedItemData || {});
  }, [selectedItemData]);

  const handleSave = async (fieldName, value) => {
    if (projectRowId) {
      await saveField(fieldName, value);
      setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    }
  };

  const handleReset = async (fieldName) => {
    if (projectRowId) {
      const latestValue = await fetchLatestData(fieldName);
      if (latestValue !== null) {
        setLocalData(prevData => ({ ...prevData, [fieldName]: latestValue }));
      }
      return latestValue;
    }
    return null;
  };

  if (!projectRowId) {
    return <div>No project selected</div>;
  }

  const fields = [
    { name: 'admin_prompt_result', placeholder: 'Admin Prompt' },
    { name: 'user_prompt_result', placeholder: 'User Prompt' },
    { name: 'input_admin_prompt', placeholder: 'Input Admin Prompt' },
    { name: 'input_user_prompt', placeholder: 'Input User Prompt' },
    { name: 'prompt_settings', placeholder: 'Prompt Settings' },
    { name: 'half_width_box_4', placeholder: 'Half Width Box 4' }
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {fields.map(field => (
        <TextAreaWithIcons
          key={field.name}
          placeholder={field.placeholder}
          value={localData[field.name] || ''}
          fieldName={field.name}
          onSave={handleSave}
          onReset={handleReset}
          readOnly={false}
        />
      ))}
    </div>
  );
};

export default ProjectPanels;
