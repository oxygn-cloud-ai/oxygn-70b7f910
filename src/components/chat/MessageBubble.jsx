import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';
import { toast } from '@/components/ui/sonner';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

// M3 Icon Button component for actions
const M3IconButton = ({ children, onClick, isActive, activeColor = 'primary', tooltip, className }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          // M3 standard icon button
          "relative h-8 w-8 rounded-m3-full",
          "flex items-center justify-center",
          "transition-all duration-m3-short2 ease-m3-standard",
          // State layer
          "before:absolute before:inset-0 before:rounded-m3-full",
          "before:bg-on-surface before:opacity-0",
          "hover:before:opacity-[0.08] active:before:opacity-[0.12]",
          // Active state
          isActive && activeColor === 'primary' && "bg-primary/10 before:bg-primary",
          isActive && activeColor === 'destructive' && "bg-destructive/10 before:bg-destructive",
          className
        )}
      >
        <span className="relative z-10">{children}</span>
      </motion.button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="font-poppins">{tooltip}</TooltipContent>
  </Tooltip>
);

const MessageBubble = ({ message, userProfile, conversationName, onRegenerate }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleFeedback = (type) => {
    setFeedback(type);
    toast.success(`Feedback recorded: ${type === 'up' ? 'Helpful' : 'Not helpful'}`);
  };

  const getInitials = () => {
    if (userProfile?.display_name) {
      return userProfile.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const timestamp = message.created_at 
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        ease: [0.2, 0, 0, 1] // M3 standard easing
      }}
      className={cn(
        'group flex gap-3 px-4 py-3',
        'transition-colors duration-m3-short2 ease-m3-standard',
        // M3 surface containers
        isUser 
          ? 'bg-primary-container/30' 
          : 'bg-surface hover:bg-surface-container-low'
      )}
    >
      {/* M3 Squircle Avatar */}
      {isUser ? (
        <Avatar className={cn(
          "h-9 w-9 shrink-0",
          "rounded-m3-medium", // M3 squircle
          "ring-2 ring-primary/20",
          "shadow-m3-1"
        )}>
          <AvatarImage 
            src={userProfile?.avatar_url} 
            alt={userProfile?.display_name || 'User'} 
            className="rounded-m3-medium"
          />
          <AvatarFallback className={cn(
            "rounded-m3-medium",
            "bg-primary text-on-primary",
            "text-label-medium font-medium font-poppins"
          )}>
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <motion.div 
          className={cn(
            "shrink-0 h-9 w-9",
            "rounded-m3-medium", // M3 squircle
            "bg-gradient-to-br from-tertiary to-tertiary/60",
            "flex items-center justify-center",
            "ring-2 ring-tertiary/20",
            "shadow-m3-1"
          )}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <Bot className="h-4 w-4 text-on-tertiary" />
        </motion.div>
      )}

      {/* Content Container */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header with M3 Typography */}
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-label-medium font-semibold font-poppins",
            isUser ? "text-on-primary-container" : "text-on-surface"
          )}>
            {isUser ? (userProfile?.display_name || 'You') : (conversationName || 'AI')}
          </span>
          {timestamp && (
            <span className="text-label-small text-on-surface-variant font-poppins">
              {timestamp}
            </span>
          )}
        </div>

        {/* Message content with M3 typography and markdown */}
        <div className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "text-body-medium leading-relaxed font-poppins",
          // M3 prose styling
          "prose-p:my-1 prose-p:text-on-surface",
          "prose-headings:my-2 prose-headings:font-poppins prose-headings:text-on-surface",
          "prose-ul:my-1 prose-ol:my-1",
          "prose-li:text-on-surface",
          // Code styling with M3 surfaces
          "prose-code:bg-surface-container prose-code:text-on-surface-variant",
          "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-m3-small",
          "prose-code:text-label-medium prose-code:font-mono",
          "prose-pre:bg-transparent prose-pre:p-0",
          // Link styling
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <div className="rounded-m3-medium overflow-hidden my-3 shadow-m3-1">
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="!rounded-m3-medium text-label-medium !my-0"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* M3 Action Bar */}
        <motion.div 
          className={cn(
            "flex items-center gap-1 pt-2",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-m3-short2 ease-m3-standard"
          )}
          initial={false}
        >
          <TooltipProvider delayDuration={300}>
            <M3IconButton
              onClick={handleCopy}
              isActive={copied}
              tooltip={TOOLTIPS.chat.copy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4 text-on-surface-variant" />
              )}
            </M3IconButton>

            {!isUser && (
              <>
                <M3IconButton
                  onClick={() => handleFeedback('up')}
                  isActive={feedback === 'up'}
                  tooltip={TOOLTIPS.chat.helpful}
                >
                  <ThumbsUp className={cn(
                    "h-4 w-4",
                    feedback === 'up' ? "text-primary" : "text-on-surface-variant"
                  )} />
                </M3IconButton>

                <M3IconButton
                  onClick={() => handleFeedback('down')}
                  isActive={feedback === 'down'}
                  activeColor="destructive"
                  tooltip={TOOLTIPS.chat.notHelpful}
                >
                  <ThumbsDown className={cn(
                    "h-4 w-4",
                    feedback === 'down' ? "text-destructive" : "text-on-surface-variant"
                  )} />
                </M3IconButton>

                {onRegenerate && (
                  <M3IconButton
                    onClick={onRegenerate}
                    tooltip={TOOLTIPS.chat.regenerate}
                  >
                    <RefreshCw className="h-4 w-4 text-on-surface-variant" />
                  </M3IconButton>
                )}
              </>
            )}
          </TooltipProvider>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;