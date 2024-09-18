import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import PopupContent from './PopupContent';
import TreeView from './TreeView';
import { Rnd } from 'react-rnd';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedItemRef = useRef(null);
  const [popupSize, setPopupSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (isOpen && parentData) {
      setSelectedItem(parentData);
      setExpandedItems([parentData.row_id]);
    }
  }, [isOpen, parentData]);

  const handleItemSelect = async (item) => {
    setSelectedItem(item);
    setIsLoading(false);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Rnd
        default={{
          x: 0,
          y: 0,
          width: popupSize.width,
          height: popupSize.height,
        }}
        minWidth={400}
        minHeight={300}
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
        onResize={(e, direction, ref, delta, position) => {
          setPopupSize({
            width: ref.offsetWidth,
            height: ref.offsetHeight,
          });
        }}
      >
        <DialogContent
          className="p-0 overflow-hidden"
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <div className="flex h-full">
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
      </Rnd>
    </Dialog>
  );
};

export default ParentPromptPopup;
