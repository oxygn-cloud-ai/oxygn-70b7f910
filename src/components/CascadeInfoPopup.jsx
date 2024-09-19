import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CascadeInfoPopup = ({ isOpen, onClose, itemName, fieldName, fieldContent }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cascade Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <p><strong>Selected Item:</strong> {itemName}</p>
            <p><strong>Field:</strong> {fieldName}</p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">Field Content:</h4>
            <p className="text-sm whitespace-pre-wrap">{fieldContent}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CascadeInfoPopup;