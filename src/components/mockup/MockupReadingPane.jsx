import React, { useState } from "react";
import { 
  FileText, 
  Sliders, 
  Variable, 
  LayoutTemplate, 
  MessageSquare,
  Play,
  Copy,
  Download,
  MoreVertical,
  ArrowLeft,
  Star,
  Trash2,
  Share2,
  Link2,
  Hash,
  List,
  Braces,
  ToggleLeft
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TabButton = ({ icon: Icon, label, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`
          h-8 w-10 flex items-center justify-center rounded-m3-sm
          transition-colors duration-150 ease-emphasized
          ${isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
        `}
        style={{ height: "32px", width: "40px" }}
      >
        <Icon className="h-5 w-5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-label-sm">
      {label}
    </TooltipContent>
  </Tooltip>
);

const IconButton = ({ icon: Icon, label, variant = "default", onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`
          h-10 w-10 flex items-center justify-center rounded-m3-full
          transition-colors duration-150 ease-emphasized
          ${variant === "primary" 
            ? "bg-primary text-primary-foreground hover:bg-primary/90" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
        `}
        style={{ height: "40px", width: "40px" }}
      >
        <Icon className="h-5 w-5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-label-sm">
      {label}
    </TooltipContent>
  </Tooltip>
);

const VariableTypeIcon = ({ type }) => {
  const icons = {
    text: Variable,
    reference: Link2,
    number: Hash,
    list: List,
    json: Braces,
    enum: ToggleLeft
  };
  const Icon = icons[type] || Variable;
  return <Icon className="h-4 w-4 text-primary" />;
};

const mockVariables = [
  { name: "customer_message", value: "", required: true, type: "text", description: "The customer's inquiry" },
  { name: "account_type", value: "Premium", required: true, type: "enum", description: "Customer account tier", options: ["Free", "Premium", "Enterprise"] },
  { name: "ticket_count", value: "3", required: false, type: "number", description: "Previous support tickets" },
  { name: "api_key", value: "••••••••", required: true, type: "text", description: "API authentication key", isSecret: true },
  { name: "base_url", value: "https://api.example.com", required: true, type: "text", description: "API endpoint base URL" },
  { name: "previous_responses", value: "", required: false, type: "list", description: "List of prior AI responses" },
  { name: "context_ref", value: "{{parent.output}}", required: false, type: "reference", description: "Reference to parent prompt output" },
  { name: "max_retries", value: "3", required: false, type: "number", description: "Maximum retry attempts" },
  { name: "custom_headers", value: '{"X-Custom": "value"}', required: false, type: "json", description: "Additional HTTP headers" },
  { name: "output_format", value: "markdown", required: true, type: "enum", description: "Response format", options: ["json", "text", "markdown"] },
];

const MockupReadingPane = ({ hasSelection = true }) => {
  const [activeTab, setActiveTab] = useState("prompt");

  const tabs = [
    { id: "prompt", icon: FileText, label: "Prompt" },
    { id: "settings", icon: Sliders, label: "Prompt Settings" },
    { id: "variables", icon: Variable, label: "Variables" },
    { id: "templates", icon: LayoutTemplate, label: "Templates" },
    { id: "conversation", icon: MessageSquare, label: "Conversation" },
  ];

  if (!hasSelection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-body-md">Select a prompt to view</p>
          <p className="text-label-md mt-1">or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Toolbar */}
      <div 
        className="h-14 flex items-center gap-2 px-4 bg-surface border-b border-outline-variant"
        style={{ height: "56px" }}
      >
        {/* Back button (mobile) */}
        <IconButton icon={ArrowLeft} label="Back to list" />

        {/* Tabs */}
        <div className="flex items-center gap-1 mx-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <IconButton icon={Star} label="Star" />
        <IconButton icon={Copy} label="Duplicate" />
        <IconButton icon={Download} label="Export" />
        <IconButton icon={Share2} label="Share" />
        <IconButton icon={Trash2} label="Delete" />
        
        {/* Run button */}
        <IconButton icon={Play} label="Run prompt" variant="primary" />
        
        <IconButton icon={MoreVertical} label="More options" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {activeTab === "prompt" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-headline-sm text-on-surface font-semibold" style={{ fontSize: "24px" }}>
                Customer Support Bot
              </h1>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Last edited Dec 23, 2024
              </p>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <label className="text-label-lg text-on-surface font-medium">
                System Prompt
              </label>
              <div 
                className="min-h-32 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                style={{ borderRadius: "12px" }}
              >
                <p className="text-body-md text-on-surface whitespace-pre-wrap">
                  You are a helpful customer support assistant for a software company. Your role is to:

                  1. Answer customer questions accurately and professionally
                  2. Help troubleshoot common issues
                  3. Escalate complex problems to human agents when needed
                  4. Maintain a friendly and empathetic tone

                  Always ask clarifying questions if the customer's issue is unclear.
                </p>
              </div>
            </div>

            {/* User Prompt */}
            <div className="space-y-2">
              <label className="text-label-lg text-on-surface font-medium">
                User Prompt
              </label>
              <div 
                className="min-h-24 p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                style={{ borderRadius: "12px" }}
              >
                <p className="text-body-md text-on-surface whitespace-pre-wrap">
                  Customer inquiry: {"{{customer_message}}"}

                  Customer context:
                  - Account type: {"{{account_type}}"}
                  - Previous tickets: {"{{ticket_count}}"}
                </p>
              </div>
            </div>

            {/* Output */}
            <div className="space-y-2">
              <label className="text-label-lg text-on-surface font-medium">
                Last Output
              </label>
              <div 
                className="min-h-24 p-4 bg-surface-container-high rounded-m3-md border border-outline-variant"
                style={{ borderRadius: "12px" }}
              >
                <p className="text-body-md text-on-surface-variant italic">
                  Run the prompt to see output here...
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-title-md text-on-surface font-semibold">Prompt Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Model</span>
                <span className="text-body-md text-on-surface-variant">gpt-4o</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Temperature</span>
                <span className="text-body-md text-on-surface-variant">0.7</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Max Tokens</span>
                <span className="text-body-md text-on-surface-variant">4096</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant">
                <span className="text-body-md text-on-surface">Top P</span>
                <span className="text-body-md text-on-surface-variant">1.0</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "variables" && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-title-md text-on-surface font-semibold">Variables</h2>
              <span className="text-label-sm text-on-surface-variant">{mockVariables.length} variables</span>
            </div>
            
            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-auto scrollbar-thin pr-2">
              {mockVariables.map((variable) => (
                <div 
                  key={variable.name}
                  className="p-4 bg-surface-container rounded-m3-md border border-outline-variant"
                  style={{ borderRadius: "12px" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <VariableTypeIcon type={variable.type} />
                    <span className="text-label-lg text-on-surface font-medium">
                      {variable.name}
                    </span>
                    {variable.required && (
                      <span className="text-label-sm text-primary">Required</span>
                    )}
                    {variable.isSecret && (
                      <span className="text-label-sm text-orange-500">Secret</span>
                    )}
                    <span className="text-label-sm text-on-surface-variant ml-auto capitalize">
                      {variable.type}
                    </span>
                  </div>
                  {variable.description && (
                    <p className="text-label-sm text-on-surface-variant mb-2">
                      {variable.description}
                    </p>
                  )}
                  <div className="h-10 px-3 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant">
                    <span className={`text-body-md ${variable.value ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {variable.value || "Enter value..."}
                    </span>
                  </div>
                  {variable.options && (
                    <div className="flex gap-1 mt-2">
                      {variable.options.map((opt) => (
                        <span 
                          key={opt}
                          className={`text-label-sm px-2 py-0.5 rounded-m3-sm ${
                            variable.value === opt 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-title-md text-on-surface font-semibold">Templates</h2>
            <p className="text-body-md text-on-surface-variant">
              No templates attached to this prompt.
            </p>
          </div>
        )}

        {activeTab === "conversation" && (
          <div className="max-w-xl mx-auto space-y-6">
            <h2 className="text-title-md text-on-surface font-semibold">Conversation</h2>
            <p className="text-body-md text-on-surface-variant">
              Start a conversation to test this prompt interactively.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockupReadingPane;
