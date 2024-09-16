import React, { useState, useEffect, useRef } from 'react';
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
import { useSupabase } from '../hooks/useSupabase';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useSupabase();
  const selectedItemRef = useRef(null);

  useEffect(() => {
    if (isOpen && parentData) {
      setSelectedItem(parentData);
      setExpandedItems([parentData.row_id]);
    }
  }, [isOpen, parentData]);

  useEffect(() => {
    const fetchItemData = async () => {
      if (selectedItem && selectedItem.id && supabase) {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('row_id', selectedItem.id)
            .single();

          if (error) throw error;
          
          setSelectedItem(prevState => ({ ...prevState, ...data }));
        } catch (error) {
          console.error('Error fetching item data:', error);
          toast.error(`Failed to fetch prompt data: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchItemData();
  }, [selectedItem?.id, supabase]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      selectedItemRef.current.focus();
    }
  }, [selectedItem]);

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
    setSelectedItem(prevItem => prevItem && prevItem.id === itemId ? null : { id: itemId });
  };

  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <AccordionItem key={item.id} value={item.id}>
        <AccordionTrigger
          ref={item.id === parentData.row_id ? selectedItemRef : null}
          className={`flex items-center py-1 px-2 rounded ${item.id === parentData.row_id ? 'bg-yellow-200' : ''}`}
          style={{ paddingLeft: `${level * 16}px` }}
        >
          <div className="flex items-center space-x-1 flex-grow">
            <FileIcon className="h-4 w-4 flex-shrink-0" />
            <span className="ml-1 cursor-pointer text-sm">
              {item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {item.children && item.children.length > 0 && renderTreeItems(item.children, level + 1)}
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
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <p>Loading...</p>
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
                <p>Select a prompt to view details</p>
              </div>
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
