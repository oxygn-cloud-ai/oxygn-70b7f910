import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (message: string, tagName?: string) => Promise<void>;
  isCommitting: boolean;
}

const CommitDialog: React.FC<CommitDialogProps> = ({ 
  open, 
  onOpenChange, 
  onCommit, 
  isCommitting 
}) => {
  const [message, setMessage] = useState('');
  const [tagName, setTagName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    await onCommit(message.trim(), tagName.trim() || undefined);
    setMessage('');
    setTagName('');
  };

  const handleClose = () => {
    setMessage('');
    setTagName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-outline-variant">
        <DialogHeader>
          <DialogTitle className="text-title-sm text-on-surface font-medium">
            Commit Changes
          </DialogTitle>
        </DialogHeader>

        <TooltipProvider>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant uppercase">
                Commit Message
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what changed..."
                className="bg-surface-container border-outline-variant text-body-sm min-h-[80px]"
                maxLength={500}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-label-sm text-on-surface-variant uppercase">
                Tag (optional)
              </label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value.replace(/[^\w\-\.]/g, ''))}
                placeholder="e.g., v1.0, production"
                className="bg-surface-container border-outline-variant text-body-sm"
                maxLength={50}
              />
              <p className="text-[10px] text-on-surface-variant">
                Alphanumeric, hyphens, and dots only
              </p>
            </div>

            {/* Icon-only footer actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                  >
                    <X className="h-4 w-4 text-on-surface-variant" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Cancel</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="submit"
                    disabled={!message.trim() || isCommitting}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-50"
                  >
                    <Check className={`h-4 w-4 ${!message.trim() || isCommitting ? 'text-on-surface-variant' : 'text-primary'}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isCommitting ? 'Committing...' : 'Commit'}</TooltipContent>
              </Tooltip>
            </div>
          </form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
};

export default CommitDialog;
