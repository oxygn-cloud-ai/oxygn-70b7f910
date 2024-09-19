import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CascadePopup = ({ isOpen, onClose, itemName, fieldName }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cascade Information</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p><strong>Selected Item:</strong> {itemName}</p>
          <p><strong>Field:</strong> {fieldName}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CascadePopup;