import React from 'react';
import { Button } from "@/components/ui/button";
import { Replace, ReplaceAll, ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';

const PromptFieldsDisplay = ({ selectedItemData, onCascade }) => {
  const fields = [
    { name: 'input_admin_prompt', label: 'Admin Prompt' },
    { name: 'input_user_prompt', label: 'User Prompt' },
    { name: 'admin_prompt_result', label: 'Admin Result' },
    { name: 'user_prompt_result', label: 'User Result' },
  ];

  const handleAction = (fieldName, action) => {
    const content = selectedItemData[fieldName];
    onCascade(content, action);
  };

  const handleCopy = (fieldName) => {
    const content = selectedItemData[fieldName];
    navigator.clipboard.writeText(content).then(() => {
      toast.success(`Copied ${fieldName} to clipboard`);
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  if (!selectedItemData) return null;

  return (
    <div className="pl-4 h-full overflow-auto">
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">{selectedItemData.prompt_name || 'Prompt Details'}</h3>
        {fields.map(field => (
          <div key={field.name} className="mb-4 relative">
            <div className="absolute top-0 right-0 flex space-x-0">
              <Button variant="ghost" size="icon" onClick={() => handleAction(field.name, 'append')} title="Append">
                <Replace className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleAction(field.name, 'overwrite')} title="Replace All">
                <ReplaceAll className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleCopy(field.name)} title="Copy to Clipboard">
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
            <h4 className="font-medium">{field.label}</h4>
            <p className="text-sm bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
              {selectedItemData[field.name] || 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptFieldsDisplay;