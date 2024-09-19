import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CascadePopup = ({ isOpen, onClose, itemName, fieldName, fieldContent }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cascade Information</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p><strong>Selected Item:</strong> {itemName}</p>
          <p><strong>Field:</strong> {fieldName}</p>
          <div className="mt-4">
            <strong>Content:</strong>
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
              {fieldContent}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CascadePopup;
