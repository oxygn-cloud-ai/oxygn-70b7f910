import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase';
import PopupContent from './PopupContent';
import TreeView from './TreeView';

const SettingsPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const supabase = useSupabase();

  useEffect(() => {
    if (isOpen && parentData) {
      setSelectedItem(parentData);
      setExpandedItems([parentData.row_id]);
      fetchItemData(parentData.row_id);
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

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px] flex flex-col p-0">
        <div className="flex flex-1 overflow-hidden">
          {isExpanded && (
            <TreeView
              treeData={treeData}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              selectedItem={selectedItem}
              setSelectedItem={handleItemSelect}
              parentData={parentData}
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
