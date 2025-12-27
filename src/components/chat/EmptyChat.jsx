import React from 'react';
import { Bot, MessageSquarePlus, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const suggestedPrompts = [
  "Write a blog post about AI trends",
  "Help me draft an email to a client",
  "Create a summary from my files",
  "Analyze this data and give insights",
];

const EmptyChat = ({ conversationName, onSendSuggestion }) => {
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        {/* Compact icon */}
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>

        {/* Title */}
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Chat with {conversationName}
        </h2>
        
        <p className="text-xs text-muted-foreground mb-4">
          Start a conversation to get help
        </p>

        {/* Suggestion chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground mb-2">
            <Lightbulb className="h-3 w-3" />
            <span>Try asking:</span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className={cn(
                  "text-[10px] h-6 px-2",
                  "bg-background/50 hover:bg-primary/5 hover:border-primary/30",
                  "transition-all hover:shadow-sm"
                )}
                onClick={() => onSendSuggestion?.(prompt)}
              >
                <MessageSquarePlus className="h-2.5 w-2.5 mr-1 text-primary" />
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyChat;