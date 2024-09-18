import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import PopupContent from './PopupContent';
import TreeView from './TreeView';
import { Rnd } from 'react-rnd';

const SettingsPopup = ({ isOpen, onClose, parentData, cascadeField, onCascade, treeData }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedItemRef = useRef(null);
  const [popupSize, setPopupSize] = useState({ width: 800, height: 600 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen && parentData) {
      setSelectedItem(parentData);
      setExpandedItems([parentData.row_id]);
    }
  }, [isOpen, parentData]);

  const handleItemSelect = async (item) => {
    setSelectedItem(null);
    setIsLoading(true);
    // Simulating data fetch
    setTimeout(() => {
      setSelectedItem(item);
      setIsLoading(false);
    }, 500);
  };

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      selectedItemRef.current.focus();
    }
  }, [selectedItem]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Rnd
        size={{ width: popupSize.width, height: popupSize.height }}
        position={position}
        onDragStop={(e, d) => setPosition({ x: d.x, y: d.y })}
        onResizeStop={(e, direction, ref, delta, position) => {
          setPopupSize({
            width: ref.style.width,
            height: ref.style.height,
          });
          setPosition(position);
        }}
        minWidth={400}
        minHeight={300}
        bounds="window"
      >
        <DialogContent className="p-0 border-none bg-transparent" style={{ width: '100%', height: '100%' }}>
          <div className="flex h-full bg-white rounded-lg overflow-hidden shadow-lg">
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
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Rnd>
    </Dialog>
  );
};

export default SettingsPopup;
