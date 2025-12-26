import React from "react";
import { Send, Paperclip, Mic, MoreVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mockMessages = [
  { id: 1, role: "user", content: "I'm having trouble with my account login. It keeps saying invalid credentials." },
  { id: 2, role: "assistant", content: "I'm sorry to hear you're having trouble logging in. Let me help you troubleshoot this.\n\nCould you tell me:\n1. Are you using the correct email address?\n2. Have you tried resetting your password?\n3. Are you seeing any specific error code?" },
  { id: 3, role: "user", content: "Yes, I'm using the right email. I tried resetting but never received the email." },
  { id: 4, role: "assistant", content: "Thank you for that information. If you're not receiving the password reset email, here are a few things to check:\n\n• Check your spam/junk folder\n• Verify the email address is spelled correctly\n• Wait a few minutes as emails can sometimes be delayed\n\nWould you like me to escalate this to our technical team?" },
];

const MockupConversationPanel = () => {
  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      {/* Header - matches main toolbar height */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        <div>
          <span className="text-title-md text-on-surface font-semibold">Conversation</span>
          <p className="text-[10px] text-on-surface-variant">Customer Support Bot • 4 messages</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <MoreVertical className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-label-sm">Options</TooltipContent>
        </Tooltip>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3 scrollbar-thin">
        {mockMessages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div 
              className={`max-w-[85%] px-3 py-2 rounded-m3-lg text-body-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-container-high text-on-surface"
              }`}
              style={{ borderRadius: "16px" }}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-outline-variant">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-h-10 px-3 py-2 bg-surface-container-high rounded-m3-lg border border-outline-variant flex items-center">
            <span className="text-body-sm text-on-surface-variant">Type a message...</span>
          </div>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Paperclip className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-label-sm">Attach</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Mic className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-label-sm">Voice</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-10 h-10 flex items-center justify-center rounded-m3-full bg-primary text-primary-foreground">
                  <Send className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-label-sm">Send</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockupConversationPanel;
