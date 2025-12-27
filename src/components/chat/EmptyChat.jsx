import React from 'react';
import { Bot, MessageSquarePlus, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-container flex items-center justify-center">
          <Bot className="h-6 w-6 text-on-primary-container" />
        </div>

        {/* Title */}
        <h2 className="text-title-medium font-semibold text-on-surface mb-1">
          Chat with {conversationName}
        </h2>
        
        <p className="text-body-small text-on-surface-variant mb-4">
          Start a conversation to get help
        </p>

        {/* Suggestion chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-label-small text-on-surface-variant mb-2">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Try asking:</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full",
                  "text-label-small bg-surface-container-high text-on-surface-variant",
                  "border border-outline-variant/50",
                  "hover:bg-secondary-container hover:text-on-secondary-container hover:border-secondary",
                  "transition-all duration-medium-1 ease-standard",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                )}
                onClick={() => onSendSuggestion?.(prompt)}
              >
                <MessageSquarePlus className="h-3 w-3" />
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyChat;
