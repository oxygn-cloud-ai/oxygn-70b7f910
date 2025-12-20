import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ThumbsUp, ThumbsDown, RefreshCw, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

const MessageBubble = ({ message, userProfile, onRegenerate }) => {
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex gap-3 px-4 py-4 transition-all',
        isUser 
          ? 'bg-gradient-to-r from-primary/5 to-primary/10' 
          : 'bg-background hover:bg-muted/30'
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20">
          <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.display_name || 'User'} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center ring-2 ring-accent/20">
          <Bot className="h-4 w-4 text-accent-foreground" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {isUser ? (userProfile?.display_name || 'You') : 'Assistant'}
          </span>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>

        {/* Message content with markdown */}
        <div className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1",
          "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs",
          "prose-pre:bg-transparent prose-pre:p-0"
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-lg text-xs !my-2"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
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

        {/* Action bar */}
        <div className={cn(
          "flex items-center gap-1 pt-1 transition-opacity",
          "opacity-0 group-hover:opacity-100"
        )}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Copy</TooltipContent>
            </Tooltip>

            {!isUser && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-6 w-6 p-0 hover:bg-muted", feedback === 'up' && "bg-primary/10")}
                      onClick={() => handleFeedback('up')}
                    >
                      <ThumbsUp className={cn("h-3 w-3", feedback === 'up' ? "text-primary" : "text-muted-foreground")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Helpful</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-6 w-6 p-0 hover:bg-muted", feedback === 'down' && "bg-destructive/10")}
                      onClick={() => handleFeedback('down')}
                    >
                      <ThumbsDown className={cn("h-3 w-3", feedback === 'down' ? "text-destructive" : "text-muted-foreground")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Not helpful</TooltipContent>
                </Tooltip>

                {onRegenerate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-muted"
                        onClick={onRegenerate}
                      >
                        <RefreshCw className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Regenerate</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
          </TooltipProvider>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;