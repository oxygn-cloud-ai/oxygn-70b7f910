import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Replace, ReplaceAll } from 'lucide-react';
import { toast } from 'sonner';
import ExpandedTreeItem from './ExpandedTreeItem';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade }) => {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  const handleAction = (content, action) => {
    if (action === 'append') {
      content = content.trim();
    }
    onCascade(content, action);
  };

  const renderField = (label, content) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold">{label}</h4>
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
      <div className="bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
        <pre className="text-sm font-sans whitespace-pre-wrap">{content}</pre>
      </div>
    </div>
  );

  const parentTreeItem = {
    id: parentData?.row_id,
    prompt_name: parentData?.prompt_name,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Parent Prompt</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto">
          <div className="mb-4">
            <ExpandedTreeItem item={parentTreeItem} level={1} />
          </div>
          <div className="space-y-4">
            {renderField("Admin Prompt", parentData?.input_admin_prompt || '')}
            {renderField("User Prompt", parentData?.input_user_prompt || '')}
            {renderField("Admin Prompt Result", parentData?.admin_prompt_result || '')}
            {renderField("User Prompt Result", parentData?.user_prompt_result || '')}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ActionButton = ({ icon, onClick, tooltip }) => (
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

export default ParentPromptPopup;
