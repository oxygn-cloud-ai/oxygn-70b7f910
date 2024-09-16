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
import TreeItem from './TreeItem';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade }) => {
  const [activeIcons, setActiveIcons] = useState({});
  const [activeItem, setActiveItem] = useState(parentData?.row_id);

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

  const parentTreeItem = {
    id: parentData?.row_id,
    prompt_name: parentData?.prompt_name,
    children: []
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] flex">
        <div className="w-1/3 border-r pr-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parent Prompt</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-16rem)]">
            <div className="overflow-x-auto whitespace-nowrap w-full">
              <TreeItem
                item={parentTreeItem}
                level={1}
                expandedItems={[parentTreeItem.id]}
                toggleItem={() => {}}
                addItem={() => {}}
                startRenaming={() => {}}
                editingItem={null}
                setEditingItem={() => {}}
                finishRenaming={() => {}}
                cancelRenaming={() => {}}
                activeItem={activeItem}
                setActiveItem={setActiveItem}
                deleteItem={() => {}}
              />
            </div>
          </div>
        </div>
        <div className="w-2/3 pl-4 overflow-y-auto">
          <div className="mt-4">
            {renderField("Admin Prompt", parentData?.input_admin_prompt || '')}
            {renderField("User Prompt", parentData?.input_user_prompt || '')}
            {renderField("Admin Prompt Result", parentData?.admin_prompt_result || '')}
            {renderField("User Prompt Result", parentData?.user_prompt_result || '')}
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
};

export default ParentPromptPopup;
