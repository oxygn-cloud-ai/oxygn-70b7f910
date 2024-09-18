import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import PopupContent from './PopupContent';
import TreeView from './TreeView';
import { useSupabase } from '../hooks/useSupabase';

const SettingsPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const supabase = useSupabase();
  const selectedItemRef = useRef(null);

  useEffect(() => {
    if (isOpen && parentData) {
      setSelectedItem(parentData);
      setExpandedItems([parentData.row_id]);
    }
  }, [isOpen, parentData]);

  const fetchItemData = async (itemId) => {
    if (itemId && supabase) {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('row_id', itemId)
          .single();

        if (error) throw error;
        
        setSelectedItem(data);
      } catch (error) {
        console.error('Error fetching item data:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleItemSelect = async (item) => {
    setSelectedItem(null);
    setIsLoading(true);
    await fetchItemData(item.id);
    setIsLoading(false);
  };

  useEffect(() => {
    if (selectedItem?.id) {
      fetchItemData(selectedItem.id);
    }
  }, [selectedItem?.id, supabase]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      selectedItemRef.current.focus();
    }
  }, [selectedItem]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="flex flex-grow overflow-hidden">
          {isExpanded && (
            <TreeView
              treeData={treeData}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              selectedItem={selectedItem}
              setSelectedItem={handleItemSelect}
              parentData={parentData}
              selectedItemRef={selectedItemRef}
            />
          )}
          <PopupContent
            isExpanded={isExpanded}
            isLoading={isLoading}
            selectedItem={selectedItem}
            cascadeField={cascadeField}
            onCascade={onCascade}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-4 left-4"
            onClick={toggleExpand}
          >
            {isExpanded ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPopup;
