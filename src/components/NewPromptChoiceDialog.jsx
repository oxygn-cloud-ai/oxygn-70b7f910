import React, { useState } from 'react';
import { FileText, LayoutTemplate, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import TemplatePickerDialog from './TemplatePickerDialog';
import { useTemplates } from '@/hooks/useTemplates';

const NewPromptChoiceDialog = ({ 
  isOpen, 
  onClose, 
  parentId = null,
  onCreatePlain,
  onPromptCreated 
}) => {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { templates } = useTemplates();
  
  const handleCreatePlain = () => {
    onCreatePlain();
    onClose();
  };

  const handleUseTemplate = () => {
    setShowTemplatePicker(true);
  };

  const handleTemplateCreated = async () => {
    if (onPromptCreated) {
      await onPromptCreated();
    }
    setShowTemplatePicker(false);
    onClose();
  };

  const handleClose = () => {
    setShowTemplatePicker(false);
    onClose();
  };

  // If template picker is shown, render that instead
  if (showTemplatePicker) {
    return (
      <TemplatePickerDialog
        isOpen={true}
        onClose={handleClose}
        parentId={parentId}
        onPromptCreated={handleTemplateCreated}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Create New Prompt</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {/* Start from Scratch Option */}
          <button
            onClick={handleCreatePlain}
            className="group relative flex items-start gap-4 p-4 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
              <FileText className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-foreground">Start from Scratch</h3>
              <p className="text-sm text-muted-foreground">
                Create a blank prompt and build it yourself
              </p>
            </div>
          </button>

          {/* Use a Template Option */}
          <button
            onClick={handleUseTemplate}
            className="group relative flex items-start gap-4 p-4 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
              <LayoutTemplate className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Use a Template</h3>
                {templates.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {templates.length} available
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Start with a pre-built structure
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewPromptChoiceDialog;
