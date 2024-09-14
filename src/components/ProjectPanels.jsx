import React from 'react';
import { Textarea } from "@/components/ui/textarea";

const ProjectPanels = ({ selectedItemData }) => {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto">
      <Textarea 
        placeholder="Admin Prompt" 
        className="w-full p-2 border rounded" 
        value={selectedItemData?.admin_prompt_result || ''}
        readOnly
      />
      <Textarea 
        placeholder="User Prompt" 
        className="w-full p-2 border rounded" 
        value={selectedItemData?.user_prompt_result || ''}
        readOnly
      />
      <div className="grid grid-cols-2 gap-4">
        <Textarea 
          placeholder="Input Admin Prompt" 
          className="w-full p-2 border rounded" 
          value={selectedItemData?.input_admin_prompt || ''}
          readOnly
        />
        <Textarea 
          placeholder="Input User Prompt" 
          className="w-full p-2 border rounded" 
          value={selectedItemData?.input_user_prompt || ''}
          readOnly
        />
        <Textarea placeholder="Prompt Settings" className="w-full p-2 border rounded" />
        <Textarea placeholder="Half Width Box 4" className="w-full p-2 border rounded" />
      </div>
    </div>
  );
};

export default ProjectPanels;
