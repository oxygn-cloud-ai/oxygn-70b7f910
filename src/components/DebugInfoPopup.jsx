import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

const DebugInfoPopup = ({ isOpen, onClose, item, onSave }) => {
  const [position, setPosition] = useState(item.position || '');

  const handleSave = async () => {
    try {
      await onSave(position);
      toast.success('Position updated successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to update position');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Debug Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Row ID</Label>
            <Input
              value={item.id}
              className="col-span-3"
              readOnly
              disabled
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Position</Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DebugInfoPopup;