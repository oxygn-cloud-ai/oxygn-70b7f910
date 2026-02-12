// @ts-nocheck
import React, { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const RollbackDialog = ({ open, onOpenChange, version, onRollback, isRollingBack }) => {
  const [createBackup, setCreateBackup] = useState(true);

  if (!version) return null;

  const handleRollback = async () => {
    await onRollback(createBackup);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-surface border-outline-variant">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-title-sm text-on-surface font-medium">
            Rollback to v{version.version_number}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-body-sm text-on-surface-variant">
            This will restore the prompt to its state at version {version.version_number}.
            {version.commit_message && (
              <span className="block mt-2 italic">"{version.commit_message}"</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 py-4">
          <Checkbox
            id="createBackup"
            checked={createBackup}
            onCheckedChange={setCreateBackup}
          />
          <label htmlFor="createBackup" className="text-body-sm text-on-surface cursor-pointer">
            Create backup of current state before rollback
          </label>
        </div>

        <TooltipProvider>
          <div className="flex items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onOpenChange(false)}
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
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-50"
                >
                  <RotateCcw className={`h-4 w-4 ${isRollingBack ? 'text-on-surface-variant' : 'text-primary'}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{isRollingBack ? 'Rolling back...' : 'Rollback'}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RollbackDialog;
