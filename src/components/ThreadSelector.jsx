import React, { useState } from 'react';
import { Plus, Trash2, MessageSquare, Info, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <h4 className="font-medium">Thread Management</h4>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <h4 className="font-semibold">Thread Mode</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>New Thread</strong> - Each execution creates a fresh
                    conversation. Best for independent queries.
                  </p>
                  <p>
                    <strong>Reuse Thread</strong> - Messages are added to the
                    existing thread, maintaining conversation history. Best for
                    iterative refinement.
                  </p>
                </div>
                <a
                  href="https://platform.openai.com/docs/assistants/how-it-works/managing-threads-and-messages"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  OpenAI Threads Documentation
                </a>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Thread Mode Selection */}
      <div className="space-y-2">
        <Label>Thread Mode</Label>
        <RadioGroup
          value={threadMode}
          onValueChange={onThreadModeChange}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new" id="mode-new" />
            <Label htmlFor="mode-new" className="font-normal cursor-pointer">
              New Thread
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reuse" id="mode-reuse" />
            <Label htmlFor="mode-reuse" className="font-normal cursor-pointer">
              Reuse Thread
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Thread Selection (only shown in reuse mode) */}
      {threadMode === 'reuse' && (
        <div className="space-y-2">
          <Label>Active Thread</Label>
          <div className="flex items-center gap-2">
            <Select
              value={activeThread?.row_id || ''}
              onValueChange={(value) => {
                const thread = threads.find((t) => t.row_id === value);
                if (thread) onSelectThread(thread);
              }}
              disabled={isLoading || threads.length === 0}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={threads.length === 0 ? "No threads available" : "Select a thread"} />
              </SelectTrigger>
              <SelectContent>
                {threads.map((thread) => (
                  <SelectItem key={thread.row_id} value={thread.row_id}>
                    {thread.name || `Thread ${thread.row_id.slice(0, 8)}`}
                    {thread.message_count > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        ({thread.message_count} msgs)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCreateThread}
                    disabled={isCreating}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create new thread</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {activeThread && (
              <AlertDialog>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete thread</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Thread?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this thread and all its messages.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteThread(activeThread.row_id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {activeThread && (
            <p className="text-xs text-muted-foreground">
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
