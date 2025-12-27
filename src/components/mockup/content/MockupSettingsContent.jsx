import React, { useState } from "react";
import { 
  Settings, Database, Key, Palette, Bell, User, 
  Link2, DollarSign, CreditCard, MessageSquare, Sparkles,
  Sun, Moon, Monitor, Check, Eye, EyeOff, Plus, Trash2, Copy
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";
import { SettingInput } from "@/components/ui/setting-input";

// Mock data
const MOCK_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", active: true, inputCost: 2.50, outputCost: 10.00 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", active: true, inputCost: 0.15, outputCost: 0.60 },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", active: false, inputCost: 10.00, outputCost: 30.00 },
  { id: "o1-preview", name: "O1 Preview", provider: "OpenAI", active: true, inputCost: 15.00, outputCost: 60.00 },
  { id: "o1-mini", name: "O1 Mini", provider: "OpenAI", active: true, inputCost: 3.00, outputCost: 12.00 },
];

// General Settings Section
const GeneralSection = () => (
  <div className="space-y-3">
    <SettingCard label="Application">
      <div className="space-y-3">
        <SettingRow label="Default Project" description="Project to open on startup">
          <SettingInput>Customer Support</SettingInput>
        </SettingRow>
        <SettingDivider />
        <SettingRow label="Auto-save" description="Automatically save changes">
          <Switch defaultChecked />
        </SettingRow>
        <SettingDivider />
        <SettingRow label="Confirm before delete" description="Show confirmation dialogs">
          <Switch defaultChecked />
        </SettingRow>
      </div>
    </SettingCard>

    <SettingCard label="Prompt Naming">
      <div className="space-y-3">
        <SettingRow label="Auto-generate names" description="Use AI to generate prompt names">
          <Switch defaultChecked />
        </SettingRow>
        <SettingDivider />
        <SettingRow label="Naming template">
          <SettingInput>{"{{category}}_{{action}}"}</SettingInput>
        </SettingRow>
      </div>
    </SettingCard>
  </div>
);

// AI Models Section
const AIModelsSection = () => {
  const [models, setModels] = useState(MOCK_MODELS);

  const toggleModel = (id) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
  };

  return (
    <div className="space-y-3">
      <SettingCard label="Available Models">
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr,100px,100px,80px] gap-3 px-3 py-2 text-[10px] text-on-surface-variant uppercase tracking-wider">
            <span>Model</span>
            <span className="text-right">Input $/1M</span>
            <span className="text-right">Output $/1M</span>
            <span className="text-center">Active</span>
          </div>
          {models.map((model, i) => (
            <div key={model.id}>
              {i > 0 && <SettingDivider />}
              <div className="grid grid-cols-[1fr,100px,100px,80px] gap-3 px-3 py-2 items-center">
                <div>
                  <span className="text-body-sm text-on-surface font-medium">{model.name}</span>
                  <span className="text-[10px] text-on-surface-variant ml-2">{model.provider}</span>
                </div>
                <span className="text-body-sm text-on-surface-variant text-right">${model.inputCost.toFixed(2)}</span>
                <span className="text-body-sm text-on-surface-variant text-right">${model.outputCost.toFixed(2)}</span>
                <div className="flex justify-center">
                  <Switch checked={model.active} onCheckedChange={() => toggleModel(model.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard label="Default Model Settings">
        <div className="space-y-3">
          <SettingRow label="Default Model">
            <SettingInput>GPT-4o</SettingInput>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Temperature" description="0.0 - 2.0">
            <SettingInput minWidth="w-16">0.7</SettingInput>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Max Tokens">
            <SettingInput minWidth="w-20">4096</SettingInput>
          </SettingRow>
        </div>
      </SettingCard>
    </div>
  );
};

// API Keys Section
const APIKeysSection = () => {
  const [showKey, setShowKey] = useState({});

  return (
    <div className="space-y-3">
      <SettingCard>
        <div className="space-y-2">
          {MOCK_API_KEYS.map((apiKey, i) => (
            <div key={apiKey.id}>
              {i > 0 && <SettingDivider className="my-2" />}
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm text-on-surface font-medium">{apiKey.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">
                      {apiKey.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[11px] text-on-surface-variant font-mono">
                      {showKey[apiKey.id] ? "sk-abc123...xyz789" : apiKey.key}
                    </code>
                    <span className="text-[10px] text-on-surface-variant">• Last used {apiKey.lastUsed}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setShowKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                        className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                      >
                        {showKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">{showKey[apiKey.id] ? "Hide" : "Show"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Copy className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Copy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>

      <Tooltip>
        <TooltipTrigger asChild>
          <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
            <Plus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Add API Key</TooltipContent>
      </Tooltip>
    </div>
  );
};

// Theme Section
const ThemeSection = () => {
  const [theme, setTheme] = useState("system");

  return (
    <div className="space-y-3">
      <SettingCard label="Appearance">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "light", icon: Sun, label: "Light" },
            { id: "dark", icon: Moon, label: "Dark" },
            { id: "system", icon: Monitor, label: "System" },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-m3-lg border transition-colors ${
                theme === option.id 
                  ? "bg-secondary-container border-outline" 
                  : "border-outline-variant hover:bg-on-surface/[0.08]"
              }`}
            >
              <option.icon className={`h-5 w-5 ${theme === option.id ? "text-secondary-container-foreground" : "text-on-surface-variant"}`} />
              <span className={`text-[11px] ${theme === option.id ? "text-secondary-container-foreground font-medium" : "text-on-surface-variant"}`}>
                {option.label}
              </span>
              {theme === option.id && <Check className="h-3.5 w-3.5 text-secondary-container-foreground" />}
            </button>
          ))}
        </div>
      </SettingCard>

      <SettingCard label="Accent Color">
        <div className="flex gap-2">
          {["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4"].map(color => (
            <button
              key={color}
              className="w-8 h-8 rounded-full border-2 border-transparent hover:border-on-surface/20 transition-colors"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </SettingCard>
    </div>
  );
};

// Notifications Section
const NotificationsSection = () => (
  <SettingCard>
    <div className="space-y-3">
      <SettingRow label="Email notifications" description="Receive updates via email">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Cascade completion" description="Notify when cascades finish">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Error alerts" description="Get notified about failures">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Usage warnings" description="Alert when approaching limits">
        <Switch />
      </SettingRow>
    </div>
  </SettingCard>
);

// Profile Section
const ProfileSection = () => (
  <SettingCard>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-full bg-tertiary-container flex items-center justify-center">
        <User className="h-6 w-6 text-on-surface-variant" />
      </div>
      <div>
        <h4 className="text-title-sm text-on-surface font-medium">John Doe</h4>
        <p className="text-body-sm text-on-surface-variant">john.doe@company.com</p>
      </div>
    </div>
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant">Display Name</label>
        <SettingInput minWidth="w-full">John Doe</SettingInput>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-on-surface-variant">Email</label>
        <SettingInput minWidth="w-full">john.doe@company.com</SettingInput>
      </div>
    </div>
  </SettingCard>
);

// Confluence Section
const ConfluenceSection = () => (
  <SettingCard>
    <div className="flex items-center gap-3 mb-3">
      <Link2 className="h-5 w-5 text-on-surface-variant" />
      <div className="flex-1">
        <h4 className="text-body-sm text-on-surface font-medium">Connected</h4>
        <p className="text-[10px] text-on-surface-variant">mycompany.atlassian.net</p>
      </div>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Active</span>
    </div>
    <div className="space-y-3">
      <SettingRow label="Auto-sync pages" description="Sync linked pages automatically">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Default space">
        <SettingInput minWidth="min-w-36">Engineering</SettingInput>
      </SettingRow>
    </div>
  </SettingCard>
);

// Cost Analytics Section
const CostAnalyticsSection = () => (
  <div className="grid grid-cols-2 gap-3">
    <SettingCard>
      <div className="text-center">
        <DollarSign className="h-5 w-5 mx-auto text-on-surface-variant mb-1" />
        <span className="text-title-sm text-on-surface font-semibold">${MOCK_COST_DATA.todayCost.toFixed(2)}</span>
        <p className="text-[10px] text-on-surface-variant">Today</p>
      </div>
    </SettingCard>
    <SettingCard>
      <div className="text-center">
        <DollarSign className="h-5 w-5 mx-auto text-on-surface-variant mb-1" />
        <span className="text-title-sm text-on-surface font-semibold">${MOCK_COST_DATA.monthCost.toFixed(2)}</span>
        <p className="text-[10px] text-on-surface-variant">This Month</p>
      </div>
    </SettingCard>
    <SettingCard>
      <div className="text-center">
        <span className="text-title-sm text-on-surface font-semibold">{MOCK_COST_DATA.totalTokens}</span>
        <p className="text-[10px] text-on-surface-variant">Total Tokens</p>
      </div>
    </SettingCard>
    <SettingCard>
      <div className="text-center">
        <span className="text-title-sm text-on-surface font-semibold">${MOCK_COST_DATA.avgCostPerPrompt}</span>
        <p className="text-[10px] text-on-surface-variant">Avg/Prompt</p>
      </div>
    </SettingCard>
  </div>
);

// Workbench Settings Section
const WorkbenchSettingsSection = () => (
  <SettingCard>
    <div className="space-y-3">
      <SettingRow label="Default model" description="Model used for new conversations">
        <SettingInput minWidth="min-w-36">GPT-4o</SettingInput>
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Enable file search" description="Allow searching uploaded files">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Enable code interpreter" description="Allow code execution">
        <Switch />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Auto-save threads" description="Save conversation history">
        <Switch defaultChecked />
      </SettingRow>
    </div>
  </SettingCard>
);

// New UI Section
const NewUISection = () => (
  <SettingCard>
    <div className="flex items-center gap-3 p-2 mb-3 bg-amber-500/10 rounded-m3-md">
      <Sparkles className="h-4 w-4 text-amber-600" />
      <span className="text-body-sm text-amber-700">You're currently using the new UI</span>
    </div>
    <div className="space-y-3">
      <SettingRow label="Enable New UI" description="Switch to the experimental interface">
        <Switch defaultChecked />
      </SettingRow>
      <SettingDivider />
      <SettingRow label="Show onboarding tips" description="Display helpful hints for new features">
        <Switch defaultChecked />
      </SettingRow>
    </div>
  </SettingCard>
);

const SETTINGS_SECTIONS = {
  general: { component: GeneralSection, icon: Settings, title: "General" },
  "ai-models": { component: AIModelsSection, icon: Database, title: "AI Models" },
  "api-keys": { component: APIKeysSection, icon: Key, title: "API Keys" },
  theme: { component: ThemeSection, icon: Palette, title: "Theme" },
  notifications: { component: NotificationsSection, icon: Bell, title: "Notifications" },
  profile: { component: ProfileSection, icon: User, title: "Profile" },
  confluence: { component: ConfluenceSection, icon: Link2, title: "Confluence" },
  "cost-analytics": { component: CostAnalyticsSection, icon: DollarSign, title: "Cost Analytics" },
  workbench: { component: WorkbenchSettingsSection, icon: MessageSquare, title: "Workbench" },
  "new-ui": { component: NewUISection, icon: Sparkles, title: "New UI (Beta)" },
};

const MockupSettingsContent = ({ activeSubItem = "general" }) => {
  const section = SETTINGS_SECTIONS[activeSubItem] || SETTINGS_SECTIONS.general;
  const SectionComponent = section.component;
  const Icon = section.icon;

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant" style={{ height: "56px" }}>
        <Icon className="h-5 w-5 text-on-surface-variant" />
        <h2 className="text-title-sm text-on-surface font-medium">{section.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl">
          <SectionComponent />
        </div>
      </div>
    </div>
  );
};

export default MockupSettingsContent;
