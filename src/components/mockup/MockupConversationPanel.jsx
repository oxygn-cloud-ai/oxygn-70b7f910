import React, { useState } from "react";
import { Send, Paperclip, Mic, MoreVertical, PanelRightClose, Plus, Trash2, Loader2, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkeletonListItem, SkeletonChat } from "./shared/MockupSkeletons";

const MockupConversationPanel = ({ 
  onClose,
  threads = [],
  activeThread,
  onSelectThread,
  messages = [],
  isLoadingThreads = false,
  isLoadingMessages = false,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  promptName = "Prompt"
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    // TODO: Wire to real send function
    setInputValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-container-low min-h-0">
      {/* Header - matches main toolbar height */}
      <div 
        className="h-14 flex items-center justify-between px-3 border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        <div>
          <span className="text-title-sm text-on-surface font-medium">Conversation</span>
          <p className="text-[10px] text-on-surface-variant">
            {promptName} • {messages.length} messages
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onCreateThread?.("New Thread")}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">New Thread</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                <MoreVertical className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Options</TooltipContent>
          </Tooltip>
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

      {/* Thread tabs if multiple threads */}
      {threads.length > 1 && (
        <div className="px-2 py-1 border-b border-outline-variant overflow-x-auto flex gap-1">
          {threads.map((thread) => (
            <button
              key={thread.row_id}
              onClick={() => onSelectThread?.(thread)}
              className={`px-2 py-1 text-[10px] rounded-m3-sm whitespace-nowrap transition-colors ${
                activeThread?.row_id === thread.row_id
                  ? "bg-secondary-container text-secondary-container-foreground"
                  : "text-on-surface-variant hover:bg-on-surface/[0.08]"
              }`}
            >
              {thread.name || "Thread"}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-2.5">
        {isLoadingMessages ? (
          <SkeletonChat />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <MessageSquare className="h-10 w-10 text-on-surface-variant/30 mb-3" />
            <p className="text-body-sm text-on-surface-variant">No messages yet</p>
            <p className="text-[10px] text-on-surface-variant/70">Start a conversation below</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, idx) => (
              <div 
                key={msg.row_id || idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] px-2.5 py-2 rounded-m3-lg text-body-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-container-high text-on-surface"
                  }`}
                  style={{ borderRadius: "14px" }}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-2.5 border-t border-outline-variant">
        <div className="flex items-end gap-1.5">
          <div className="flex-1 min-h-9 px-2.5 py-2 bg-surface-container-high rounded-m3-lg border border-outline-variant flex items-center">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none resize-y"
            />
          </div>
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

export default MockupConversationPanel;