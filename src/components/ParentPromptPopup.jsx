import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Replace, ReplaceAll } from 'lucide-react';
import { toast } from 'sonner';
import TreeItem from './TreeItem';
import { Accordion } from "@/components/ui/accordion";

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedItem(parentData);
    }
  }, [isOpen, parentData]);

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

  const toggleItem = (itemId) => {
    setSelectedItem(itemId);
  };

  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={level}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={() => {}}
        startRenaming={() => {}}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={() => {}}
        cancelRenaming={() => {}}
        activeItem={selectedItem}
        setActiveItem={setSelectedItem}
        deleteItem={() => {}}
      />
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] flex">
        <div className="w-1/3 border-r pr-4 overflow-y-auto">
          <DialogHeader>
            <div className="text-lg font-semibold">Select Prompt</div>
          </DialogHeader>
          <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-16rem)]">
            <Accordion
              type="multiple"
              value={expandedItems}
              onValueChange={setExpandedItems}
              className="w-full min-w-max"
            >
              {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
            </Accordion>
          </div>
        </div>
        <div className="w-2/3 pl-4 overflow-y-auto">
          <div className="mt-4">
            {selectedItem && (
              <>
                {renderField("Admin Prompt", selectedItem.input_admin_prompt || '')}
                {renderField("User Prompt", selectedItem.input_user_prompt || '')}
                {renderField("Admin Prompt Result", selectedItem.admin_prompt_result || '')}
                {renderField("User Prompt Result", selectedItem.user_prompt_result || '')}
              </>
            )}
          </div>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
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
