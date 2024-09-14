import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSaveField } from '../hooks/useSaveField';

const TextAreaWithIcons = ({ placeholder, value, fieldName, onSave, readOnly }) => {
  const [text, setText] = useState(value || '');

  const handleSave = () => {
    onSave(fieldName, text);
  };

  return (
    <div className="relative mb-4">
      <div className="absolute top-2 left-2 z-10 flex space-x-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
          <Save className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6">
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

const ActionButtons = () => (
  <div className="flex space-x-4 mb-4">
    <Button variant="link" className="p-0">Generate Prompts</Button>
    <Button variant="link" className="p-0">Revert</Button>
    <Button variant="link" className="p-0">Save</Button>
  </div>
);

const ProjectPanels = ({ selectedItemData }) => {
  const { saveField, isSaving } = useSaveField(selectedItemData?.project_row_id);

  const handleSave = (fieldName, value) => {
    saveField(fieldName, value);
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <ActionButtons />
      <TextAreaWithIcons 
        placeholder="Admin Prompt" 
        value={selectedItemData?.admin_prompt_result}
        fieldName="admin_prompt_result"
        onSave={handleSave}
        readOnly={false}
      />
      <TextAreaWithIcons 
        placeholder="User Prompt" 
        value={selectedItemData?.user_prompt_result}
        fieldName="user_prompt_result"
        onSave={handleSave}
        readOnly={false}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextAreaWithIcons 
          placeholder="Input Admin Prompt" 
          value={selectedItemData?.input_admin_prompt}
          fieldName="input_admin_prompt"
          onSave={handleSave}
          readOnly={false}
        />
        <TextAreaWithIcons 
          placeholder="Input User Prompt" 
          value={selectedItemData?.input_user_prompt}
          fieldName="input_user_prompt"
          onSave={handleSave}
          readOnly={false}
        />
        <TextAreaWithIcons 
          placeholder="Prompt Settings"
          fieldName="prompt_settings"
          onSave={handleSave}
          readOnly={false}
        />
        <TextAreaWithIcons 
          placeholder="Half Width Box 4"
          fieldName="half_width_box_4"
          onSave={handleSave}
          readOnly={false}
        />
      </div>
    </div>
  );
};

export default ProjectPanels;
