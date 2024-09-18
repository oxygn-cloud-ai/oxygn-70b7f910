import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSupabase } from '../hooks/useSupabase';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import PromptLibraryAccordion from './PromptLibraryAccordion';
import PromptFieldsDisplay from './PromptFieldsDisplay';

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

  const toggleAccordion = () => {
    setIsAccordionVisible(!isAccordionVisible);
  };

  const handleCascadeAction = (content, action) => {
    onCascade(content, action);
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
                  <PromptLibraryAccordion
                    treeData={treeData}
                    expandedItems={expandedItems}
                    toggleItem={toggleItem}
                    addItem={addItem}
                    startRenaming={startRenaming}
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    finishRenaming={finishRenaming}
                    cancelRenaming={cancelRenaming}
                    activeItem={popupActiveItem}
                    setActiveItem={setPopupActiveItem}
                    deleteItem={deleteItem}
                  />
                </Panel>
                <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors" />
              </>
            )}
            <Panel minSize={20}>
              <PromptFieldsDisplay
                selectedItemData={selectedItemData}
                onCascade={handleCascadeAction}
                cascadeField={cascadeField}
              />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </Rnd>
  );
};

export default PromptLibraryPopup;
