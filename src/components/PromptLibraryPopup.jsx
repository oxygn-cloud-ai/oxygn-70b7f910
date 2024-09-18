import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, ChevronsLeft, ChevronsRight, Replace, ReplaceAll, ClipboardCopy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';
import { useSupabase } from '../hooks/useSupabase';
import { toast } from 'sonner';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

const PromptLibraryPopup = ({ isOpen, onClose, treeData, expandedItems, toggleItem, addItem, startRenaming, editingItem, setEditingItem, finishRenaming, cancelRenaming, deleteItem, parentId, onCascade, cascadeField }) => {
  const [popupActiveItem, setPopupActiveItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const [isAccordionVisible, setIsAccordionVisible] = useState(false);
  const supabase = useSupabase();
  const popupRef = useRef(null);

  useEffect(() => {
    if (isOpen && parentId) {
      setPopupActiveItem(parentId);
      fetchItemData(parentId);
      setIsAccordionVisible(false);
    }
  }, [isOpen, parentId]);

  useEffect(() => {
    if (popupActiveItem) {
      fetchItemData(popupActiveItem);
    }
  }, [popupActiveItem]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchItemData = async (itemId) => {
    if (itemId && supabase) {
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('row_id', itemId)
          .single();

        if (error) throw error;
        
        setSelectedItemData(data);
      } catch (error) {
        console.error('Error fetching item data:', error);
        setSelectedItemData(null);
      }
    }
  };

  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={level}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={addItem}
        startRenaming={startRenaming}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={finishRenaming}
        cancelRenaming={cancelRenaming}
        activeItem={popupActiveItem}
        setActiveItem={(itemId) => {
          setPopupActiveItem(itemId);
          fetchItemData(itemId);
        }}
        deleteItem={deleteItem}
      />
    ));
  };

  const renderAccordion = () => (
    <Accordion
      type="multiple"
      value={expandedItems}
      className="w-full min-w-max"
    >
      {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
    </Accordion>
  );

  const renderPromptFields = () => {
    if (!selectedItemData) return null;

    const fields = [
      { name: 'input_admin_prompt', label: 'Admin Prompt' },
      { name: 'input_user_prompt', label: 'User Prompt' },
      { name: 'admin_prompt_result', label: 'Admin Result' },
      { name: 'user_prompt_result', label: 'User Result' },
    ];

    const handleAppend = (fieldName) => {
      onCascade(selectedItemData[fieldName], 'append');
    };

    const handleReplaceAll = (fieldName) => {
      onCascade(selectedItemData[fieldName], 'overwrite');
    };

    const handleCopy = (fieldName) => {
      const content = selectedItemData[fieldName];
      navigator.clipboard.writeText(content).then(() => {
        toast.success(`Copied ${fieldName} to clipboard`);
      }).catch((err) => {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy text');
      });
    };

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">{selectedItemData.prompt_name || 'Prompt Details'}</h3>
        {fields.map(field => (
          <div key={field.name} className="mb-4 relative">
            <div className="absolute top-0 right-0 flex space-x-0">
              <Button variant="ghost" size="icon" onClick={() => handleAppend(field.name)} title="Append">
                <Replace className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleReplaceAll(field.name)} title="Replace All">
                <ReplaceAll className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleCopy(field.name)} title="Copy to Clipboard">
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
            <h4 className="font-medium">{field.label}</h4>
            <p className="text-sm bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
              {selectedItemData[field.name] || 'N/A'}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const toggleAccordion = () => {
    setIsAccordionVisible(!isAccordionVisible);
  };

  if (!isOpen) return null;

  return (
    <Rnd
      default={{x: 0, y: 0, width: 800, height: 600}}
      minWidth={400}
      minHeight={400}
      bounds="window"
      enableResizing={{
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true
      }}
      resizeHandleStyles={{
        top: { cursor: 'n-resize' },
        right: { cursor: 'e-resize' },
        bottom: { cursor: 's-resize' },
        left: { cursor: 'w-resize' },
        topRight: { cursor: 'ne-resize' },
        bottomRight: { cursor: 'se-resize' },
        bottomLeft: { cursor: 'sw-resize' },
        topLeft: { cursor: 'nw-resize' }
      }}
    >
      <div ref={popupRef} className="bg-white border rounded-lg shadow-lg p-4 w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <h2 className="text-xl font-bold mr-2">Prompt Library</h2>
            <Button variant="ghost" size="icon" onClick={toggleAccordion}>
              {isAccordionVisible ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-grow overflow-auto">
          <PanelGroup direction="horizontal">
            {isAccordionVisible && (
              <>
                <Panel minSize={20}>
                  <div className="pr-4 border-r h-full overflow-auto">
                    {renderAccordion()}
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors" />
              </>
            )}
            <Panel minSize={20}>
              <div className="pl-4 h-full overflow-auto">
                {renderPromptFields()}
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </Rnd>
  );
};

export default PromptLibraryPopup;
