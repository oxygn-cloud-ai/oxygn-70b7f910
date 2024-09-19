import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Links from '../pages/Links';

const ParentPromptPopup = ({ isOpen, onClose, parentData, cascadeField, onUpdateParentData }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[80vw] max-h-[80vh] w-full h-full overflow-hidden">
        <Links 
          isPopup={true} 
          parentData={parentData} 
          cascadeField={cascadeField} 
          onUpdateParentData={onUpdateParentData}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ParentPromptPopup;
