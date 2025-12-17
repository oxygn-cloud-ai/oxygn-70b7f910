import React from 'react';
import { Bot, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

const StudioSidebar = ({
  assistantPrompts,
  selectedAssistantId,
  onSelectAssistant,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="h-full border-r border-border bg-card/50 p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground mb-3">Assistants</div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (assistantPrompts.length === 0) {
    return (
      <div className="h-full border-r border-border bg-card/50 p-3">
        <div className="text-xs font-medium text-muted-foreground mb-3">Assistants</div>
        <div className="text-sm text-muted-foreground text-center py-8">
          No assistants found. Create one in the Projects page.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full border-r border-border bg-card/50 flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="text-xs font-medium text-muted-foreground">Assistants</div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {assistantPrompts.map((item) => {
            const isSelected = selectedAssistantId === item.promptRowId;
            const isInstantiated = item.assistant?.status === 'active';

            return (
              <button
                key={item.promptRowId}
                onClick={() => onSelectAssistant(item.promptRowId)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50 text-foreground'
                )}
              >
                <Bot className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.assistant?.name || item.promptName}
                  </div>
                </div>
                <Circle
                  className={cn(
                    'h-2 w-2 shrink-0',
                    isInstantiated ? 'fill-green-500 text-green-500' : 'fill-muted text-muted'
                  )}
                />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default StudioSidebar;
