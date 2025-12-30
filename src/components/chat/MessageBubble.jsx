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
import { TOOLTIPS } from '@/config/labels';
import { toast } from '@/components/ui/sonner';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex gap-2 px-3 py-2 transition-all',
        isUser 
          ? 'bg-gradient-to-r from-primary/5 to-primary/10' 
          : 'bg-background hover:bg-muted/30'
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar className="h-6 w-6 shrink-0 ring-1 ring-primary/20">
          <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.display_name || 'User'} />
          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center ring-1 ring-accent/20">
          <Bot className="h-3 w-3 text-accent-foreground" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-tree font-semibold text-foreground">
            {isUser ? (userProfile?.display_name || 'You') : (conversationName || 'AI')}
          </span>
          {timestamp && (
            <span className="text-compact text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>

        {/* Message content with markdown */}
        <div className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-headings:text-on-surface prose-headings:font-semibold prose-headings:my-2",
          "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
          "prose-p:text-on-surface prose-p:my-1.5 prose-p:text-[13px] prose-p:leading-relaxed",
          "prose-strong:text-on-surface prose-strong:font-semibold",
          "prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-li:text-[13px]",
          "prose-code:bg-surface-container prose-code:text-primary prose-code:px-1 prose-code:py-0.5 prose-code:rounded-m3-sm prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-transparent prose-pre:p-0",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
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
              <TooltipContent side="bottom">{TOOLTIPS.chat.copy}</TooltipContent>
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
                  <TooltipContent side="bottom">{TOOLTIPS.chat.helpful}</TooltipContent>
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
                  <TooltipContent side="bottom">{TOOLTIPS.chat.notHelpful}</TooltipContent>
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
                    <TooltipContent side="bottom">{TOOLTIPS.chat.regenerate}</TooltipContent>
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