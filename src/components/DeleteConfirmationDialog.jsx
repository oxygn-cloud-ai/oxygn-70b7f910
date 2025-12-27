import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DeleteConfirmationDialog = ({ isOpen, onOpenChange, confirmCount, onConfirm }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-surface-container-high border-outline-variant">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-headline-small text-on-surface">
            Are you absolutely sure?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-body-medium text-on-surface-variant">
            {confirmCount === 0
              ? "This action will delete the project and all its contents. This action cannot be undone."
              : "Please confirm once more that you want to delete this project and all its contents."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-highest">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-error text-on-error hover:bg-error/90"
          >
            {confirmCount === 0 ? "Confirm" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmationDialog;
