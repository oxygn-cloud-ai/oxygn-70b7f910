import React from 'react';
import { Rnd } from 'react-rnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ParentPromptPopup = ({ isOpen, onClose, adminPrompt, userPromptResult }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px]">
        <Rnd
          default={{
            x: 0,
            y: 0,
            width: '100%',
            height: '100%',
          }}
          minWidth={600}
          minHeight={400}
          bounds="parent"
        >
          <div className="w-full h-full p-4 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Parent Prompt Information</DialogTitle>
            </DialogHeader>
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
        </Rnd>
      </DialogContent>
    </Dialog>
  );
};

export default ParentPromptPopup;
