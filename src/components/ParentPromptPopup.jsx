import React from 'react';
import { Rnd } from 'react-rnd';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ParentPromptPopup = ({ adminPrompt, userPromptResult, onClose }) => {
  return (
    <Rnd
      default={{
        x: window.innerWidth / 2 - 500,
        y: window.innerHeight / 2 - 300,
        width: 1000,
        height: 600,
      }}
      minWidth={600}
      minHeight={400}
      bounds="window"
      style={{ zIndex: 9999 }}
    >
      <DialogContent className="w-full h-full p-0 overflow-hidden" style={{ width: '1000px', maxWidth: '90vw' }}>
        <div className="drag-handle w-full h-8 bg-gray-200 cursor-move" />
        <div className="p-4 overflow-y-auto h-[calc(100%-2rem)]">
          <DialogHeader><DialogTitle>Parent Prompt Information</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="admin-prompt" className="text-right">Admin Prompt</label>
              <Textarea id="admin-prompt" value={adminPrompt} readOnly className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="user-prompt-result" className="text-right">User Prompt Result</label>
              <Textarea id="user-prompt-result" value={userPromptResult} readOnly className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Close</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Rnd>
  );
};

export default ParentPromptPopup;
