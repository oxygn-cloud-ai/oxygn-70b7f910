import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Send, Paperclip, Mic, PanelRightClose, Loader2, 
  Plus, Maximize2, Brain, Square
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkeletonChat } from "@/components/shared/Skeletons";
import ThinkingIndicator from "@/components/chat/ThinkingIndicator";
import ModelReasoningSelector from "@/components/chat/ModelReasoningSelector";
import { MessageItem } from "@/components/chat/MessageItem";
import { ToolActivityIndicator } from "@/components/chat/ToolActivityIndicator";
import { ThreadDropdown } from "@/components/chat/ThreadDropdown";
import { useModels } from "@/hooks/useModels";
import type { UsePromptFamilyChatReturn } from "@/hooks/usePromptFamilyChat";
import type { ChatMessage, ToolActivity } from "@/types/chat";

interface ConversationPanelProps {
  onClose?: () => void;
  promptName?: string;
  promptFamilyChat?: UsePromptFamilyChatReturn;
  // Legacy props
  messages?: ChatMessage[];
  isLoadingMessages?: boolean;
  isSending?: boolean;
  onSendMessage?: (message: string) => Promise<void>;
  onCancel?: () => void;
  progress?: { type: string; message?: string } | null;
  onToggleReadingPane?: () => void;
  readingPaneOpen?: boolean;
}

const ConversationPanel = ({ 
  onClose,
  promptName = "Prompt",
  promptFamilyChat,
  messages: legacyMessages,
  isLoadingMessages: legacyIsLoadingMessages,
  isSending: legacyIsSending,
  onSendMessage: legacyOnSendMessage,
  onCancel,
  progress,
  onToggleReadingPane,
  readingPaneOpen = true,
}: ConversationPanelProps) => {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get models for selector
  const { getActiveModels, getModelConfig } = useModels();
  const activeModels = getActiveModels();

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 20;
    const minHeight = lineHeight;
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = newHeight + 'px';
  }, []);

  // Use prompt family chat if available
  const usePromptFamilyMode = !!promptFamilyChat;
  
  const messages = usePromptFamilyMode 
    ? promptFamilyChat.messages 
    : (legacyMessages || []);
    
  const isLoadingMessages = usePromptFamilyMode 
    ? promptFamilyChat.isLoading 
    : legacyIsLoadingMessages;
    
  const isSending = usePromptFamilyMode 
    ? (promptFamilyChat.isStreaming || promptFamilyChat.isExecutingTools)
    : legacyIsSending;

  const streamingMessage = usePromptFamilyMode ? promptFamilyChat.streamingMessage : '';
  const thinkingText = usePromptFamilyMode ? promptFamilyChat.thinkingText : '';
  const toolActivity = usePromptFamilyMode ? promptFamilyChat.toolActivity : [];
  const isExecutingTools = usePromptFamilyMode ? promptFamilyChat.isExecutingTools : false;

  // Session model/reasoning
  const sessionModel = usePromptFamilyMode ? promptFamilyChat.sessionModel : null;
  const setSessionModel = usePromptFamilyMode ? promptFamilyChat.setSessionModel : () => {};
  const sessionReasoningEffort = usePromptFamilyMode ? promptFamilyChat.sessionReasoningEffort : 'auto';
  const setSessionReasoningEffort = usePromptFamilyMode ? promptFamilyChat.setSessionReasoningEffort : () => {};

  // Model config for reasoning support
  const currentModelId = sessionModel || activeModels[0]?.model_id;
  const currentModelConfig = currentModelId ? getModelConfig(currentModelId) : null;
  const supportsReasoning = currentModelConfig?.supportsReasoningEffort ?? false;
  const defaultModelName = activeModels[0]?.model_name || 'Default';

  // Smart auto-scroll
  const isNearBottom = useRef(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollCleanupRef = useRef<(() => void) | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach scroll listener
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    
    const attachListener = () => {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewport) {
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeoutRef.current = setTimeout(attachListener, 100);
        }
        return;
      }
      
      const handleScroll = () => {
        const threshold = 100;
        const el = viewport as HTMLElement;
        isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      };
      
      viewport.addEventListener('scroll', handleScroll, { passive: true });
      scrollCleanupRef.current = () => viewport.removeEventListener('scroll', handleScroll);
    };
    
    attachListener();
    
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      scrollCleanupRef.current?.();
    };
  }, []);

  // Auto-scroll when near bottom
  useEffect(() => {
    if (!isNearBottom.current) return;
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollRef.current && isNearBottom.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      }
    }, 100);
    
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [messages, isSending, streamingMessage]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    const message = inputValue.trim();
    setInputValue("");
    
    if (usePromptFamilyMode && promptFamilyChat) {
      let threadId = promptFamilyChat.activeThreadId;
      console.log('[Chat] handleSend - activeThreadId:', threadId);
      if (!threadId) {
        console.log('[Chat] No active thread, creating new one...');
        const newThread = await promptFamilyChat.createThread('New Chat');
        if (!newThread) {
          console.error('[Chat] Failed to create thread');
          return;
        }
        threadId = newThread.row_id;
        console.log('[Chat] Created thread:', threadId);
      }
      console.log('[Chat] Sending message to thread:', threadId);
      await promptFamilyChat.sendMessage(message, threadId, {
        model: sessionModel,
        reasoningEffort: sessionReasoningEffort
      });
      console.log('[Chat] sendMessage completed');
    } else if (legacyOnSendMessage) {
      await legacyOnSendMessage(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Build display messages
  const displayMessages = [...messages];
  if (streamingMessage && usePromptFamilyMode) {
    const lastMsg = displayMessages[displayMessages.length - 1];
    if (lastMsg?.role !== 'assistant' || lastMsg.content !== streamingMessage) {
      displayMessages.push({
        row_id: 'streaming',
        role: 'assistant',
        content: streamingMessage
      });
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-container-low min-h-0">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant gap-3">
        <span className="text-body-sm font-medium text-on-surface shrink-0">Chat</span>
        <div className="flex-1 min-w-0">
          {usePromptFamilyMode && promptFamilyChat ? (
            <div className="flex items-center gap-2">
              <ThreadDropdown
                threads={promptFamilyChat.threads}
                activeThread={promptFamilyChat.activeThread}
                onSelectThread={promptFamilyChat.switchThread}
                onCreateThread={promptFamilyChat.createThread}
                onDeleteThread={promptFamilyChat.deleteThread}
              />
              <span className="text-[10px] text-on-surface-variant">
                {displayMessages.length} msg{displayMessages.length !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-title-sm text-on-surface font-medium">Conversation</span>
              <p className="text-[10px] text-on-surface-variant">
                {promptName} • {messages.length} messages
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {!readingPaneOpen && onToggleReadingPane && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleReadingPane}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show prompt panel</TooltipContent>
            </Tooltip>
          )}
          {usePromptFamilyMode && promptFamilyChat?.activeThreadId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => promptFamilyChat.createThread()}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">New chat</TooltipContent>
            </Tooltip>
          )}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Hide panel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-2.5" ref={scrollRef}>
        {isLoadingMessages ? (
          <SkeletonChat />
        ) : displayMessages.length === 0 && !isSending ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <img 
              src="/Qonsol-Full-Logo_Transparent_NoBuffer.png" 
              alt="Qonsol" 
              className="h-6 mb-3 opacity-50 dark:brightness-0 dark:invert"
            />
            <p className="text-body-sm text-on-surface-variant">
              {usePromptFamilyMode 
                ? "Ask me anything about this prompt family" 
                : "No messages yet"
              }
            </p>
            <p className="text-[10px] text-on-surface-variant/70">
              {usePromptFamilyMode
                ? "I can explore files, confluence, schemas & more"
                : "Start a conversation below"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayMessages.map((msg, idx) => (
              <MessageItem 
                key={msg.row_id || idx}
                msg={msg}
                isStreaming={msg.row_id === 'streaming'}
              />
            ))}
            
            {/* Reasoning/Thinking indicator */}
            {isSending && usePromptFamilyMode && promptFamilyChat && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-2.5 py-2 bg-surface-container rounded-m3-lg space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-primary animate-pulse" />
                      <span className="font-medium">{thinkingText ? 'Reasoning' : 'Thinking'}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => promptFamilyChat.cancelStream()}
                          className="w-5 h-5 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high"
                        >
                          <Square className="h-2.5 w-2.5 text-on-surface-variant" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">Cancel</TooltipContent>
                    </Tooltip>
                  </div>
                  {thinkingText && (
                    <div className="text-[11px] text-on-surface-variant whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {thinkingText}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Tool activity indicator */}
            {isExecutingTools && (
              <ToolActivityIndicator toolActivity={toolActivity} isExecuting={isExecutingTools} />
            )}
            
            {/* Legacy thinking indicator */}
            {isSending && !usePromptFamilyMode && (
              <ThinkingIndicator 
                conversationName={promptName}
                onCancel={onCancel}
                progress={progress}
              />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-2.5 border-t border-outline-variant space-y-1.5">
        <div className="flex-1 min-h-9 px-2.5 py-2 bg-surface-container-high rounded-m3-lg border border-outline-variant flex items-start">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder={usePromptFamilyMode ? "Ask about this prompt family..." : "Type a message..."}
            rows={1}
            className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none resize-none overflow-y-auto"
            style={{ minHeight: '20px', maxHeight: '400px' }}
          />
        </div>
        <div className="flex items-center justify-between">
          {usePromptFamilyMode ? (
            <ModelReasoningSelector
              selectedModel={sessionModel}
              onModelChange={setSessionModel}
              activeModels={activeModels}
              defaultModelName={defaultModelName}
              reasoningEffort={sessionReasoningEffort}
              onReasoningChange={setSessionReasoningEffort}
              supportsReasoning={supportsReasoning}
            />
          ) : (
            <div />
          )}
          <div className="flex gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Paperclip className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Attach</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Mic className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Voice</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Send</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPanel;
