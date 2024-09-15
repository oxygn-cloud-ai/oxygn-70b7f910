import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rnd } from 'react-rnd';

const ParentPromptPopup = ({ adminPrompt, userPromptResult, onClose }) => {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <Rnd
        default={{
          x: window.innerWidth / 2 - 400,
          y: window.innerHeight / 2 - 200,
          width: 800,
          height: 400,
        }}
        minWidth={800}
        minHeight={300}
        bounds="window"
        style={{ zIndex: 9999 }}
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
        dragHandleClassName="drag-handle"
      >
        <DialogContent className="w-full h-full p-0 overflow-hidden" style={{ width: '800px', maxWidth: '100vw' }}>
          <div className="drag-handle w-full h-8 bg-gray-200 cursor-move" />
          <div className="p-4 overflow-y-auto h-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle>Parent Prompt Information</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="admin-prompt" className="text-right">
                  Admin Prompt
                </label>
                <Textarea
                  id="admin-prompt"
                  value={adminPrompt}
                  readOnly
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="user-prompt-result" className="text-right">
                  User Prompt Result
                </label>
                <Textarea
                  id="user-prompt-result"
                  value={userPromptResult}
                  readOnly
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Rnd>
    </Dialog>
  );
};

export default ParentPromptPopup;
