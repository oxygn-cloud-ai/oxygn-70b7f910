import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

const ParentPromptPopup = ({ isOpen, onClose, adminPrompt, userPromptResult }) => {
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(content)}
          className="h-6 w-6 p-0"
        >
          <Copy className="h-4 w-4" />
        </Button>
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
          <DialogTitle>Parent Prompt Information</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {renderField("Admin Prompt", adminPrompt)}
          {renderField("User Prompt Result", userPromptResult)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ParentPromptPopup;
