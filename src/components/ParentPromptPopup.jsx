import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade }) => {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  const renderField = (label, content) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(content)}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {cascadeField && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCascade(content)}
              className="h-6 px-2 py-0 text-xs"
            >
              Cascade
            </Button>
          )}
        </div>
      </div>
      <div className="bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
        <pre className="text-sm whitespace-pre-wrap">{content}</pre>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Parent Prompt: {parentData?.prompt_name || 'Unknown'}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {renderField("Admin Prompt", parentData?.input_admin_prompt || '')}
          {renderField("User Prompt", parentData?.input_user_prompt || '')}
          {renderField("Admin Prompt Result", parentData?.admin_prompt_result || '')}
          {renderField("User Prompt Result", parentData?.user_prompt_result || '')}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ParentPromptPopup;
