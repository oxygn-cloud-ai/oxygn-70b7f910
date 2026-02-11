import { useState, useEffect } from 'react';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { LayoutTemplate, Lock, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTemplates } from '@/hooks/useTemplates';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptId?: string;
  promptName?: string;
  hasChildren?: boolean;
  onSuccess?: () => void;
}

const SaveAsTemplateDialog = ({
  open,
  onOpenChange,
  promptId,
  promptName,
  hasChildren = false,
  onSuccess,
}: SaveAsTemplateDialogProps) => {
  const { createFromPrompt } = useTemplates();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [isShared, setIsShared] = useState(true); // Default: shared with all users
  const [includeChildren, setIncludeChildren] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill name when dialog opens
  useEffect(() => {
    if (open && promptName) {
      setName(`${promptName} Template`);
    }
  }, [open, promptName]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setCategory('general');
      setIsShared(true);
      setIncludeChildren(true);
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!promptId) {
      toast.error('No prompt selected');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createFromPrompt(promptId, {
        name: name.trim(),
        description: description.trim(),
        category,
        isPrivate: !isShared,
        includeChildren: hasChildren ? includeChildren : false,
      });

      if (result) {
        trackEvent('template_created_from_dialog', {
          prompt_row_id: promptId,
          template_name: name,
          is_shared: isShared,
          include_children: includeChildren,
          category,
        });
        toast.success(`Template "${name}" created`);
        onSuccess?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-surface border-outline-variant">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-on-surface">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Save as Template
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant">
            Create a reusable template from this prompt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-label-sm text-on-surface-variant uppercase">
              Template Name
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Template"
              className="bg-surface-container border-outline-variant"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description" className="text-label-sm text-on-surface-variant uppercase">
              Description
            </Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for..."
              rows={3}
              className="bg-surface-container border-outline-variant resize-none"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="template-category" className="text-label-sm text-on-surface-variant uppercase">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-surface-container border-outline-variant">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="creative">Creative</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {isShared ? (
                <Users className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-on-surface-variant" />
              )}
              <div>
                <div className="text-body-sm text-on-surface">
                  {isShared ? 'Shared with all users' : 'Private (only you)'}
                </div>
                <div className="text-[10px] text-on-surface-variant">
                  {isShared 
                    ? 'Anyone in the workspace can use this template'
                    : 'Only you can see and use this template'
                  }
                </div>
              </div>
            </div>
            <Switch
              checked={isShared}
              onCheckedChange={(v: boolean) => setIsShared(v)}
            />
          </div>

          {/* Include Children Checkbox - only show if prompt has children */}
          {hasChildren && (
            <div className="flex items-center gap-3 py-2 border-t border-outline-variant pt-4">
              <Checkbox
                id="include-children"
                checked={includeChildren}
                onCheckedChange={(v: CheckedState) => setIncludeChildren(v === true)}
              />
              <div>
                <Label 
                  htmlFor="include-children" 
                  className="text-body-sm text-on-surface cursor-pointer"
                >
                  Include all child prompts
                </Label>
                <div className="text-[10px] text-on-surface-variant">
                  Save the entire prompt hierarchy as a template
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-outline-variant"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveAsTemplateDialog;
