import React from 'react';
import { Textarea } from "@/components/ui/textarea";

const ProjectPanels = () => {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto">
      <Textarea placeholder="Admin Prompt" className="w-full p-2 border rounded" />
      <Textarea placeholder="User Prompt" className="w-full p-2 border rounded" />
      <div className="grid grid-cols-2 gap-4">
        <Textarea placeholder="Input Admin Prompt" className="w-full p-2 border rounded" />
        <Textarea placeholder="Input User Prompt" className="w-full p-2 border rounded" />
        <Textarea placeholder="Prompt Settings" className="w-full p-2 border rounded" />
        <Textarea placeholder="Half Width Box 4" className="w-full p-2 border rounded" />
      </div>
    </div>
  );
};

export default ProjectPanels;