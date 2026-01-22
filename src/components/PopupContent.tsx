import React, { ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Replace, ReplaceAll } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface SelectedItem {
  input_admin_prompt?: string | null;
  input_user_prompt?: string | null;
  admin_prompt_result?: string | null;
  user_prompt_result?: string | null;
  [key: string]: unknown;
}

interface PopupContentProps {
  isExpanded: boolean;
  isLoading: boolean;
  selectedItem: SelectedItem | null;
  cascadeField?: string | null;
  onCascade: (content: string, action: 'append' | 'overwrite') => void;
}

interface ActionButtonProps {
  icon: ReactNode;
  onClick: () => void;
  tooltip: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, onClick, tooltip }) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0"
    onClick={onClick}
    title={tooltip}
  >
    {icon}
  </Button>
);

const PopupContent: React.FC<PopupContentProps> = ({ 
  isExpanded, 
  isLoading, 
  selectedItem, 
  cascadeField, 
  onCascade 
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  const handleAction = (content: string, action: 'append' | 'overwrite') => {
    let processedContent = content;
    if (action === 'append') {
      processedContent = content.trim();
    }
    onCascade(processedContent, action);
  };

  const renderField = (label: string, content: string) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-body-sm font-semibold text-on-surface">{label}</h4>
        <div className="flex space-x-2">
          {cascadeField && (
            <>
              <ActionButton
                icon={<ReplaceAll className="h-4 w-4" />}
                onClick={() => handleAction(content, 'append')}
                tooltip="Append"
              />
              <ActionButton
                icon={<Replace className="h-4 w-4" />}
                onClick={() => handleAction(content, 'overwrite')}
                tooltip="Overwrite"
              />
            </>
          )}
          <ActionButton
            icon={<Copy className="h-4 w-4" />}
            onClick={() => copyToClipboard(content)}
            tooltip="Copy"
          />
        </div>
      </div>
      <div className="bg-surface-container p-2 rounded-m3-sm overflow-auto max-h-40">
        <pre className="text-body-sm whitespace-pre-wrap text-on-surface">{content}</pre>
      </div>
    </div>
  );

  return (
    <div className={`${isExpanded ? 'w-2/3' : 'w-full'} pl-4 overflow-y-auto`}>
      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-on-surface-variant">Loading...</p>
          </div>
        ) : selectedItem ? (
          <>
            {renderField("Admin Prompt", selectedItem.input_admin_prompt || '')}
            {renderField("User Prompt", selectedItem.input_user_prompt || '')}
            {renderField("Admin Prompt Result", selectedItem.admin_prompt_result || '')}
            {renderField("User Prompt Result", selectedItem.user_prompt_result || '')}
          </>
        ) : (
          <div className="flex justify-center items-center h-full">
            <p className="text-on-surface-variant">Select a prompt to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupContent;
