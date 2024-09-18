import React from 'react';
import { Rnd } from 'react-rnd';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";

const PromptLibraryPopup = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Rnd
      default={{
        x: 50,
        y: 50,
        width: 400,
        height: 400,
      }}
      minWidth={200}
      minHeight={200}
      bounds="window"
    >
      <div className="bg-white border rounded-lg shadow-lg p-4 w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Prompt Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-grow overflow-auto">
          {/* Content will be added here in future updates */}
        </div>
      </div>
    </Rnd>
  );
};

export default PromptLibraryPopup;