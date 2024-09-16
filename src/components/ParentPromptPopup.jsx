import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Replace, ReplaceAll, ChevronRight, FileIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);

  useEffect(() => {
    if (isOpen && parentData) {
      setSelectedItem(parentData);
      setExpandedItems([parentData.row_id]);
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

  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <AccordionItem key={item.id} value={item.id}>
        <AccordionTrigger>
          <TreeItem
            item={item}
            level={level}
            isSelected={selectedItem && selectedItem.row_id === item.id}
            onClick={() => setSelectedItem(item)}
          />
        </AccordionTrigger>
        <AccordionContent>
          {item.children && item.children.length > 0 && (
            <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems}>
              {renderTreeItems(item.children, level + 1)}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
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

const TreeItem = ({ item, level, isSelected, onClick }) => {
  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`;

  return (
    <div
      className={`flex items-center py-1 px-2 rounded ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
      onClick={onClick}
    >
      {item.children && item.children.length > 0 ? (
        <ChevronRight className="h-4 w-4 flex-shrink-0 mr-2" />
      ) : (
        <div className="w-4 h-4 flex-shrink-0 mr-2" />
      )}
      <FileIcon className="h-4 w-4 flex-shrink-0 mr-2" />
      <span className={`ml-1 cursor-pointer text-sm ${isSelected ? 'text-blue-600 font-bold' : 'text-gray-600 font-normal'}`}>
        {displayName}
      </span>
    </div>
  );
};

export default ParentPromptPopup;
