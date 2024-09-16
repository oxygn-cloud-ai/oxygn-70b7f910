import React, { useState } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade }) => {
  const [activeIcons, setActiveIcons] = useState({});
  const [expandedItems, setExpandedItems] = useState(['parent']);

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
      // Remove any leading or trailing whitespace
      content = content.trim();
    }
    onCascade(content, action);
    setActiveIcons({ [action]: true });
    setTimeout(() => setActiveIcons({}), 1000);
  };

  const renderField = (label, content) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        <div className="flex space-x-2">
          {cascadeField && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(content, 'append')}
                className={`h-6 w-6 p-0 ${activeIcons['append'] ? 'text-green-700' : 'text-green-700'}`}
              >
                <ReplaceAll className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(content, 'overwrite')}
                className={`h-6 w-6 p-0 ${activeIcons['overwrite'] ? 'text-green-700' : 'text-green-700'}`}
              >
                <Replace className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(content)}
            className={`h-6 w-6 p-0 ${activeIcons['copy'] ? 'text-green-700' : 'text-green-700'}`}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
        <pre className="text-sm font-sans whitespace-pre-wrap">{content}</pre>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Parent Prompt: {parentData?.prompt_name || 'Unknown'}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow flex overflow-hidden">
          <div className="w-1/3 overflow-y-auto border-r pr-4">
            <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems}>
              <AccordionItem value="parent" className="border-b-0">
                <AccordionTrigger className="py-2 text-sm font-semibold bg-blue-100 rounded">
                  {parentData?.prompt_name || 'Parent Prompt'}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="pl-4 py-2">
                    <li className="text-sm py-1">Admin Prompt</li>
                    <li className="text-sm py-1">User Prompt</li>
                    <li className="text-sm py-1">Admin Result</li>
                    <li className="text-sm py-1">User Result</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <div className="w-2/3 overflow-y-auto pl-4">
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

export default ParentPromptPopup;
