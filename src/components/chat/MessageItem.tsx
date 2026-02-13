import { memo, lazy, Suspense, useCallback } from 'react';
import type { ChatMessage } from '@/types/chat';

const ReactMarkdown = lazy(() => import('react-markdown'));

interface MessageItemProps {
  msg: ChatMessage;
  isStreaming?: boolean;
}

// Sanitize URLs to prevent javascript: XSS attacks
const sanitizeUrl = (url: string): string | undefined => {
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'vbscript:' || parsed.protocol === 'data:') {
      return undefined;
    }
    return url;
  } catch {
    return url; // Relative URLs are safe
  }
};

export const MessageItem = memo<MessageItemProps>(({ msg, isStreaming }) => (
  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div 
      className={`max-w-[85%] px-2.5 py-2 rounded-m3-lg text-body-sm ${
        msg.role === 'user'
          ? 'bg-primary text-primary-foreground'
          : 'bg-surface-container-high text-on-surface'
      }`}
      style={{ borderRadius: '14px' }}
    >
      {msg.role === 'assistant' ? (
        <Suspense fallback={<div className="animate-pulse h-4 bg-surface-container rounded w-3/4" />}>
          <div className="prose prose-sm max-w-none text-on-surface prose-p:my-1 prose-headings:my-2">
            <ReactMarkdown urlTransform={sanitizeUrl}>{msg.content}</ReactMarkdown>
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />}
          </div>
        </Suspense>
      ) : (
        <p className="whitespace-pre-wrap">{msg.content}</p>
      )}
    </div>
  </div>
), (prev, next) => {
  return prev.msg.content === next.msg.content && 
         prev.msg.role === next.msg.role &&
         prev.msg.row_id === next.msg.row_id &&
         prev.isStreaming === next.isStreaming;
});

MessageItem.displayName = 'MessageItem';
