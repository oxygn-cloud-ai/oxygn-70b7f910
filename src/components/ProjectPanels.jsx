import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

const TextAreaWithIcons = ({ placeholder, value, readOnly }) => (
  <div className="relative mb-4">
    <div className="absolute top-2 left-2 z-10 flex space-x-1">
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <Save className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <X className="h-4 w-4" />
      </Button>
    </div>
    <Textarea 
      placeholder={placeholder} 
      className="w-full p-2 pl-16 border rounded" 
      value={value || ''}
      readOnly={readOnly}
    />
  </div>
);

const ProjectPanels = ({ selectedItemData }) => {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      <TextAreaWithIcons 
        placeholder="Admin Prompt" 
        value={selectedItemData?.admin_prompt_result}
        readOnly
      />
      <TextAreaWithIcons 
        placeholder="User Prompt" 
        value={selectedItemData?.user_prompt_result}
        readOnly
      />
      <div className="grid grid-cols-2 gap-4">
        <TextAreaWithIcons 
          placeholder="Input Admin Prompt" 
          value={selectedItemData?.input_admin_prompt}
          readOnly
        />
        <TextAreaWithIcons 
          placeholder="Input User Prompt" 
          value={selectedItemData?.input_user_prompt}
          readOnly
        />
        <TextAreaWithIcons placeholder="Prompt Settings" />
        <TextAreaWithIcons placeholder="Half Width Box 4" />
      </div>
    </div>
  );
};

export default ProjectPanels;
