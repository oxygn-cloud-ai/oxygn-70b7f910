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
import { Accordion } from "@/components/ui/accordion";
import { useSupabase } from '../hooks/useSupabase';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [selectedItemContent, setSelectedItemContent] = useState(null);
  const supabase = useSupabase();

  useEffect(() => {
    if (isOpen) {
      setSelectedItem(parentData);
    }
  }, [isOpen, parentData]);

  useEffect(() => {
    const fetchSelectedItemContent = async () => {
      if (selectedItem && supabase) {
        try {
          const { data, error } = await supabase
            .from('prompts')
            .select('input_admin_prompt, input_user_prompt, admin_prompt_result, user_prompt_result')
            .eq('row_id', selectedItem.id)
            .single();

          if (error) throw error;
          setSelectedItemContent(data);
        } catch (error) {
          console.error('Error fetching selected item content:', error);
          toast.error('Failed to fetch selected item content');
        }
      }
    };

    fetchSelectedItemContent();
  }, [selectedItem, supabase]);

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
        activeItem={selectedItem}
        setActiveItem={setSelectedItem}
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
            {selectedItemContent && (
              <>
                {renderField("Admin Prompt", selectedItemContent.input_admin_prompt || '')}
                {renderField("User Prompt", selectedItemContent.input_user_prompt || '')}
                {renderField("Admin Prompt Result", selectedItemContent.admin_prompt_result || '')}
                {renderField("User Prompt Result", selectedItemContent.user_prompt_result || '')}
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

const TreeItem = ({ item, level, expandedItems, toggleItem, activeItem, setActiveItem }) => {
  const isActive = activeItem && activeItem.id === item.id;
  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`;

  return (
    <div className={`border-none ${level === 1 ? 'pt-3' : 'pt-0'} pb-0.1`}>
      <div
        className={`flex items-center hover:bg-gray-100 py-0 px-2 rounded ${isActive ? 'bg-blue-100' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => setActiveItem(item)}
      >
        <div className="flex items-center space-x-1 flex-grow">
          {item.children && item.children.length > 0 ? (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 flex-shrink-0" />
          )}
          <FileIcon className="h-4 w-4 flex-shrink-0" />
          <span 
            className={`ml-1 cursor-pointer text-sm ${isActive ? 'text-blue-600 font-bold' : 'text-gray-600 font-normal'}`}
          >
            {displayName}
          </span>
        </div>
      </div>
      {item.children && item.children.length > 0 && (
        <div>
          {item.children.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ParentPromptPopup;
