import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';
import { useSupabase } from '../hooks/useSupabase';

const PromptLibraryPopup = ({ isOpen, onClose, treeData, expandedItems, toggleItem, addItem, startRenaming, editingItem, setEditingItem, finishRenaming, cancelRenaming, deleteItem, parentId }) => {
  const [popupActiveItem, setPopupActiveItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const [isAccordionVisible, setIsAccordionVisible] = useState(true);
  const supabase = useSupabase();
  const popupRef = useRef(null);
  const [popupSize, setPopupSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (isOpen && parentId) {
      setPopupActiveItem(parentId);
      fetchItemData(parentId);
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

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Prompt Details</h3>
        {fields.map(field => (
          <div key={field.name} className="mb-4">
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
      default={{
        x: window.innerWidth / 2 - 400,
        y: 0,
        width: 800,
        height: 600,
      }}
      minWidth={400}
      minHeight={400}
      bounds="window"
    >
      <div ref={popupRef} className="bg-white border rounded-lg shadow-lg p-4 w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Prompt Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-grow overflow-auto">
          <div className="w-full h-full flex">
            {isAccordionVisible && (
              <div className="w-1/2 pr-4 border-r">
                {renderAccordion()}
              </div>
            )}
            <div className={isAccordionVisible ? "w-1/2 pl-4" : "w-full"}>
              {renderPromptFields()}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-4 left-4"
          onClick={toggleAccordion}
        >
          {isAccordionVisible ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </Button>
      </div>
    </Rnd>
  );
};

export default PromptLibraryPopup;
