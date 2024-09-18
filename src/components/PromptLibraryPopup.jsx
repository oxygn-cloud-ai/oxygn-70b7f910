import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSupabase } from '../hooks/useSupabase';
import PromptLibraryAccordion from './PromptLibraryAccordion';
import PromptFieldsDisplay from './PromptFieldsDisplay';

const PromptLibraryPopup = ({ isOpen, onClose, treeData, expandedItems, toggleItem, addItem, startRenaming, editingItem, setEditingItem, finishRenaming, cancelRenaming, deleteItem, parentId, onCascade, cascadeField }) => {
  const [popupActiveItem, setPopupActiveItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const [isAccordionVisible, setIsAccordionVisible] = useState(false);
  const [accordionWidth, setAccordionWidth] = useState(300);
  const supabase = useSupabase();
  const popupRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (parentId) {
        setPopupActiveItem(parentId);
        fetchItemData(parentId);
        setIsAccordionVisible(false);
      } else {
        setIsAccordionVisible(true);
      }
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

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
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

  const startResize = (e) => {
    e.preventDefault();
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  };

  const resize = (e) => {
    if (resizeRef.current) {
      const newWidth = e.clientX - resizeRef.current.getBoundingClientRect().left;
      setAccordionWidth(newWidth);
    }
  };

  const stopResize = () => {
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  };

  if (!isOpen) return null;

  return (
    <div ref={popupRef} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-4/5 h-4/5 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
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
        <div className="flex-grow flex overflow-hidden">
          {isAccordionVisible && (
            <div style={{ width: `${accordionWidth}px`, minWidth: '200px', maxWidth: '50%' }} className="border-r">
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
              <div
                ref={resizeRef}
                className="w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize absolute right-0 top-0 bottom-0"
                onMouseDown={startResize}
              ></div>
            </div>
          )}
          <div className="flex-grow overflow-auto">
            <PromptFieldsDisplay
              selectedItemData={selectedItemData}
              onCascade={handleCascadeAction}
              cascadeField={cascadeField}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptLibraryPopup;
