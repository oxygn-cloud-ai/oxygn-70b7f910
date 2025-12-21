import React from 'react';
import { Bot, Sparkles, MessageSquarePlus, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const suggestedPrompts = [
  "What can you help me with?",
  "Summarize the main points",
  "Explain this in simple terms",
  "Give me some examples",
];

const EmptyChat = ({ conversationName, onSendSuggestion, childPromptsCount = 0 }) => {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Animated avatar */}
        <motion.div
          className="relative w-20 h-20 mx-auto mb-6"
          animate={{ 
            y: [0, -8, 0],
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-xl" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-4 ring-primary/10">
            <Bot className="h-10 w-10 text-primary-foreground" />
          </div>
          
          {/* Sparkle decorations */}
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-5 w-5 text-primary" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Chat with {conversationName}
        </h2>
        
        <p className="text-sm text-muted-foreground mb-6">
          Start a conversation to get help with your tasks
        </p>

        {/* Capabilities */}
        {childPromptsCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm mb-6">
            <Sparkles className="h-4 w-4" />
            <span>Has access to {childPromptsCount} child prompt{childPromptsCount > 1 ? 's' : ''} for context</span>
          </div>
        )}

        {/* Suggestion chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Try asking:</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedPrompts.map((prompt, index) => (
              <motion.div
                key={prompt}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "text-xs h-8 px-3",
                    "bg-background/50 hover:bg-primary/5 hover:border-primary/30",
                    "transition-all hover:shadow-sm"
                  )}
                  onClick={() => onSendSuggestion?.(prompt)}
                >
                  <MessageSquarePlus className="h-3 w-3 mr-1.5 text-primary" />
                  {prompt}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyChat;