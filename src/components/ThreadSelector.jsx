import React, { useState } from 'react';
import { Plus, Trash2, MessageSquare, Info, ExternalLink } from 'lucide-react';
import { M3IconButton } from '@/components/ui/m3-icon-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TOOLTIPS } from '@/config/labels';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ThreadSelector = ({
  threads,
  activeThread,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  threadMode,
  onThreadModeChange,
  isLoading,
}) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateThread = async () => {
    setIsCreating(true);
    const name = `Thread ${new Date().toLocaleString()}`;
    await onCreateThread(name);
    setIsCreating(false);
  };

  return (
    <div className="space-y-4 border border-outline-variant rounded-xl p-4 bg-surface-container-low">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-on-surface-variant" />
          <h4 className="text-title-small font-medium text-on-surface">Thread Management</h4>
          <Popover>
            <PopoverTrigger asChild>
              <M3IconButton size="small" tooltip="Thread mode info">
                <Info className="h-5 w-5" />
              </M3IconButton>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-surface-container-high border-outline-variant">
              <div className="space-y-3">
                <h4 className="text-title-small font-semibold text-on-surface">Thread Mode</h4>
                <div className="space-y-2 text-body-small text-on-surface-variant">
                  <p>
                    <strong className="text-on-surface">New Thread</strong> - Each execution creates a fresh
                    conversation. Best for independent queries.
                  </p>
                  <p>
                    <strong className="text-on-surface">Reuse Thread</strong> - Messages are added to the
                    existing thread, maintaining conversation history. Best for
                    iterative refinement.
                  </p>
                </div>
                <a
                  href="https://platform.openai.com/docs/api-reference/responses"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-label-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Responses API Documentation
                </a>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Thread Mode Selection */}
      <div className="space-y-2">
        <Label className="text-label-medium text-on-surface-variant">Thread Mode</Label>
        <RadioGroup
          value={threadMode}
          onValueChange={onThreadModeChange}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new" id="mode-new" className="border-outline" />
            <Label htmlFor="mode-new" className="text-body-medium text-on-surface cursor-pointer">
              New Thread
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reuse" id="mode-reuse" className="border-outline" />
            <Label htmlFor="mode-reuse" className="text-body-medium text-on-surface cursor-pointer">
              Reuse Thread
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Thread Selection (only shown in reuse mode) */}
      {threadMode === 'reuse' && (
        <div className="space-y-2">
          <Label className="text-label-medium text-on-surface-variant">Active Thread</Label>
          <div className="flex items-center gap-2">
            <Select
              value={activeThread?.row_id || ''}
              onValueChange={(value) => {
                const thread = threads.find((t) => t.row_id === value);
                if (thread) onSelectThread(thread);
              }}
              disabled={isLoading || threads.length === 0}
            >
              <SelectTrigger className="flex-1 bg-surface-container border-outline-variant text-on-surface">
                <SelectValue placeholder={threads.length === 0 ? "No threads available" : "Select a thread"} />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-high border-outline-variant">
                {threads.map((thread) => (
                  <SelectItem key={thread.row_id} value={thread.row_id} className="text-on-surface">
                    {thread.name || `Thread ${thread.row_id.slice(0, 8)}`}
                    {thread.message_count > 0 && (
                      <span className="ml-2 text-on-surface-variant">
                        ({thread.message_count} msgs)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <M3IconButton
              size="small"
              tooltip={TOOLTIPS.threads.createNew}
              onClick={handleCreateThread}
              disabled={isCreating}
            >
              <Plus className="h-5 w-5" />
            </M3IconButton>

            {activeThread && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <M3IconButton size="small" tooltip={TOOLTIPS.threads.delete}>
                    <Trash2 className="h-5 w-5 text-error" />
                  </M3IconButton>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-surface-container-high border-outline-variant">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-headline-small text-on-surface">Delete Thread?</AlertDialogTitle>
                    <AlertDialogDescription className="text-body-medium text-on-surface-variant">
                      This will permanently delete this thread and all its messages.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-surface-container text-on-surface border-outline-variant">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteThread(activeThread.row_id)}
                      className="bg-error text-on-error hover:bg-error/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {activeThread && (
            <p className="text-label-small text-on-surface-variant">
              {activeThread.message_count || 0} messages • Last updated:{' '}
              {activeThread.last_message_at
                ? new Date(activeThread.last_message_at).toLocaleString()
                : 'Never'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ThreadSelector;
