import { useState, useEffect, useRef, useCallback, memo, lazy, Suspense } from "react";
import { 
  Send, Paperclip, Mic, PanelRightClose, Loader2, 
  Plus, Trash2, ChevronDown, Wrench, Check, Maximize2, MessageSquare, Brain
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkeletonChat } from "@/components/shared/Skeletons";
import ThinkingIndicator from "@/components/chat/ThinkingIndicator";
import ModelReasoningSelector from "@/components/chat/ModelReasoningSelector";
import { useModels } from "@/hooks/useModels";

// Lazy load ReactMarkdown for performance
const ReactMarkdown = lazy(() => import("react-markdown"));

// Memoized message component to prevent unnecessary re-renders
const MemoizedMessage = memo(({ msg, isStreaming }) => (
  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
    <div 
      className={`max-w-[85%] px-2.5 py-2 rounded-m3-lg text-body-sm ${
        msg.role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-surface-container-high text-on-surface"
      }`}
      style={{ borderRadius: "14px" }}
    >
      {msg.role === 'assistant' ? (
        <Suspense fallback={<div className="animate-pulse h-4 bg-surface-container rounded w-3/4" />}>
          <div className="prose prose-sm max-w-none text-on-surface prose-p:my-1 prose-headings:my-2">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        </Suspense>
      ) : (
        <p className="whitespace-pre-wrap">{msg.content}</p>
      )}
    </div>
  </div>
), (prev, next) => {
  // Only re-render if content or role actually changed
  return prev.msg.content === next.msg.content && 
         prev.msg.role === next.msg.role &&
         prev.msg.row_id === next.msg.row_id &&
         prev.isStreaming === next.isStreaming;
});

// Tool Activity Indicator
const ToolActivityIndicator = ({ toolActivity, isExecuting }) => {
  if (!toolActivity || toolActivity.length === 0) return null;

  return (
    <div className="px-2 py-1.5 bg-surface-container rounded-m3-md mb-2">
      <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
        <Wrench className="h-3 w-3" />
        <span>Using tools:</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {toolActivity.map((tool, idx) => (
          <span 
            key={idx}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${
              tool.status === 'running' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-green-500/10 text-green-600'
            }`}
          >
            {tool.status === 'running' ? (
              <Loader2 className="h-2 w-2 animate-spin" />
            ) : (
              <Check className="h-2 w-2" />
            )}
            {tool.name}
          </span>
        ))}
      </div>
    </div>
  );
};

// Thread Selector Dropdown
const ThreadSelector = ({ threads, activeThread, onSelectThread, onCreateThread, onDeleteThread }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-m3-sm bg-surface-container hover:bg-surface-container-high text-body-sm text-on-surface"
      >
        <span className="truncate max-w-[120px]">
          {activeThread?.title || 'Select chat'}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-surface-container-high rounded-m3-md shadow-lg border border-outline-variant z-20 py-1 max-h-64 overflow-auto">
          <button
            onClick={() => {
              onCreateThread?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-body-sm text-primary hover:bg-surface-container"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
          
          {threads.length > 0 && <div className="h-px bg-outline-variant my-1" />}
          
          {threads.map(thread => (
            <div 
              key={thread.row_id}
              className={`flex items-center justify-between px-3 py-1.5 hover:bg-surface-container group ${
                activeThread?.row_id === thread.row_id ? 'bg-surface-container' : ''
              }`}
            >
              <button
                onClick={() => {
                  onSelectThread?.(thread.row_id);
                  setIsOpen(false);
                }}
                className="flex-1 text-left text-body-sm text-on-surface truncate"
              >
                {thread.title || 'Untitled'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteThread?.(thread.row_id);
                }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:text-destructive hover:bg-surface-container"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ConversationPanel = ({ 
  onClose,
  promptName = "Prompt",
  // Prompt Family Chat props
  promptFamilyChat,
  // Legacy props (kept for backwards compatibility)
  messages: legacyMessages,
  isLoadingMessages: legacyIsLoadingMessages,
  isSending: legacyIsSending,
  onSendMessage: legacyOnSendMessage,
  onCancel,
  progress,
  onToggleReadingPane,
  readingPaneOpen = true,
}) => {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Get models for selector
  const { getActiveModels, getModelConfig } = useModels();
  const activeModels = getActiveModels();

  // Auto-resize textarea based on content
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get proper scrollHeight
    textarea.style.height = 'auto';
    
    const lineHeight = 20;
    const maxHeight = lineHeight * 20; // 20 lines max
    const minHeight = lineHeight; // 1 line min
    
    // Set height based on content, clamped between min and max
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = newHeight + 'px';
  }, []);

  // Use prompt family chat if available, otherwise fall back to legacy
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
  const isStreaming = usePromptFamilyMode ? promptFamilyChat.isStreaming : false;

  // Get session model/reasoning from hook
  const sessionModel = usePromptFamilyMode ? promptFamilyChat.sessionModel : null;
  const setSessionModel = usePromptFamilyMode ? promptFamilyChat.setSessionModel : () => {};
  const sessionReasoningEffort = usePromptFamilyMode ? promptFamilyChat.sessionReasoningEffort : 'auto';
  const setSessionReasoningEffort = usePromptFamilyMode ? promptFamilyChat.setSessionReasoningEffort : () => {};

  // Calculate current model config for reasoning support
  const currentModelId = sessionModel || activeModels[0]?.model_id;
  const currentModelConfig = currentModelId ? getModelConfig(currentModelId) : null;
  const supportsReasoning = currentModelConfig?.supportsReasoningEffort ?? false;
  const defaultModelName = activeModels[0]?.model_name || 'Default';

  // Smart auto-scroll: track if user is near bottom
  const isNearBottom = useRef(true);
  const scrollTimeoutRef = useRef(null);
  const scrollCleanupRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Attach scroll listener to track user position (Radix ScrollArea workaround with retry)
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
        isNearBottom.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
      };
      
      viewport.addEventListener('scroll', handleScroll, { passive: true });
      scrollCleanupRef.current = () => viewport.removeEventListener('scroll', handleScroll);
    };
    
    attachListener();
    
    return () => {
      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      // Call stored cleanup function
      scrollCleanupRef.current?.();
      scrollCleanupRef.current = null;
    };
  }, []);

  // Auto-scroll only if user is near bottom, debounced
  useEffect(() => {
    // Only scroll if user is near bottom
    if (!isNearBottom.current) return;
    
    // Debounce scroll operations
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollRef.current && isNearBottom.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    }, 100);
    
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [messages, isSending, streamingMessage]);

  const handleSend = async () => {
    console.log('[ChatDebug] handleSend called, isSending:', isSending, 'inputValue:', inputValue.slice(0, 50));
    if (!inputValue.trim() || isSending) {
      console.log('[ChatDebug] handleSend blocked - empty input or already sending');
      return;
    }
    const message = inputValue.trim();
    setInputValue("");
    
    if (usePromptFamilyMode) {
      // Ensure we have a thread - pass returned thread ID to sendMessage
      let threadId = promptFamilyChat.activeThreadId;
      if (!threadId) {
        const newThread = await promptFamilyChat.createThread('New Chat');
        threadId = newThread?.row_id;
      }
      if (threadId) {
        await promptFamilyChat.sendMessage(message, threadId, {
          model: sessionModel,
          reasoningEffort: sessionReasoningEffort
        });
      }
    } else if (legacyOnSendMessage) {
      await legacyOnSendMessage(message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages = [...messages];
  // Add streaming message as temporary assistant message
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
      <div 
        className="h-14 flex items-center justify-between px-3 border-b border-outline-variant gap-3"
        style={{ height: "56px" }}
      >
        <span className="text-body-sm font-medium text-on-surface shrink-0">Chat</span>
        <div className="flex-1 min-w-0">
          {usePromptFamilyMode ? (
            <div className="flex items-center gap-2">
              <ThreadSelector
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
          {usePromptFamilyMode && promptFamilyChat.activeThreadId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={promptFamilyChat.createThread}
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
            {usePromptFamilyMode && (
              <p className="text-[10px] text-on-surface-variant/70 mt-1">
                I can also show you how to use Qonsol
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {displayMessages.map((msg, idx) => (
              <MemoizedMessage 
                key={msg.row_id || idx}
                msg={msg}
                isStreaming={msg.row_id === 'streaming'}
              />
            ))}
            
            {/* Reasoning/Thinking indicator - shown while AI is processing */}
            {isSending && usePromptFamilyMode && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-2.5 py-2 bg-surface-container rounded-m3-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                    <Brain className="h-3 w-3 text-primary animate-pulse" />
                    <span className="font-medium">{thinkingText ? 'Reasoning' : 'Thinking'}</span>
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
            
            {/* Thinking indicator when sending (legacy mode) */}
            {isSending && !usePromptFamilyMode && (
              <ThinkingIndicator 
                conversationName={promptName}
                onCancel={onCancel}
                progress={progress}
              />
            )}
            
            {/* Streaming indicator for prompt family mode */}
            {isSending && usePromptFamilyMode && !streamingMessage && (
              <div className="flex justify-start">
                <div className="px-2.5 py-2 bg-surface-container-high rounded-m3-lg" style={{ borderRadius: "14px" }}>
                  <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                </div>
              </div>
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
          {/* Model and Reasoning Selectors - only in prompt family mode */}
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
