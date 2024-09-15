import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Rnd } from 'react-rnd';

const ParentPromptPopup = ({ adminPrompt, userPromptResult, onClose }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const centerX = window.innerWidth / 2 - 200; // 200 is half the default width
    const centerY = window.innerHeight / 2 - 200; // 200 is half the default height
    setPosition({ x: centerX, y: centerY });
  }, []);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <Rnd
        default={{
          x: position.x,
          y: position.y,
          width: 400,
          height: 400,
        }}
        minWidth={300}
        minHeight={300}
        bounds="window"
      >
        <DialogContent className="sm:max-w-[425px] w-full h-full resize overflow-auto" style={{ position: 'static' }}>
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
        </DialogContent>
      </Rnd>
    </Dialog>
  );
};

export default ParentPromptPopup;
