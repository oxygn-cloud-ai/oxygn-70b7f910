import React, { useState } from "react";
import { 
  Settings, Database, Key, Palette, Bell, User, 
  Link2, DollarSign, CreditCard, MessageSquare, Sparkles,
  Sun, Moon, Monitor, Check, Eye, EyeOff, Plus, Trash2, Copy
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";

// Mock data
const MOCK_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", active: true, inputCost: 2.50, outputCost: 10.00 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", active: true, inputCost: 0.15, outputCost: 0.60 },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", active: false, inputCost: 10.00, outputCost: 30.00 },
  { id: "o1-preview", name: "O1 Preview", provider: "OpenAI", active: true, inputCost: 15.00, outputCost: 60.00 },
  { id: "o1-mini", name: "O1 Mini", provider: "OpenAI", active: true, inputCost: 3.00, outputCost: 12.00 },
];

const MOCK_API_KEYS = [
  { id: "1", name: "OpenAI API Key", key: "sk-...XyZ7", status: "valid", lastUsed: "2 hours ago" },
  { id: "2", name: "Confluence Token", key: "ATATT...9kLm", status: "valid", lastUsed: "1 day ago" },
];

const MOCK_COST_DATA = {
  todayCost: 12.47,
  monthCost: 234.89,
  totalTokens: "1.2M",
  avgCostPerPrompt: 0.023,
};

const SettingSection = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-title-md text-on-surface font-semibold">{title}</h3>
      {description && <p className="text-body-sm text-on-surface-variant mt-1">{description}</p>}
    </div>
    {children}
  </div>
);

const SettingCard = ({ children, className = "" }) => (
  <div className={`p-4 bg-surface-container-low rounded-m3-lg border border-outline-variant ${className}`}>
    {children}
  </div>
);

const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1 min-w-0">
      <span className="text-body-md text-on-surface">{label}</span>
      {description && <p className="text-body-sm text-on-surface-variant mt-0.5">{description}</p>}
    </div>
    {children}
  </div>
);

// General Settings Section
const GeneralSection = () => (
  <div className="space-y-6">
    <SettingSection title="Application" description="Configure application-wide preferences">
      <SettingCard>
        <div className="space-y-4">
          <SettingRow label="Default Project" description="Project to open on startup">
            <div className="h-9 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-48">
              <span className="text-body-sm text-on-surface">Customer Support</span>
            </div>
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Auto-save" description="Automatically save changes">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Confirm before delete" description="Show confirmation dialogs">
            <Switch defaultChecked />
          </SettingRow>
        </div>
      </SettingCard>
    </SettingSection>

    <SettingSection title="Prompt Naming" description="Configure automatic prompt naming">
      <SettingCard>
        <div className="space-y-4">
          <SettingRow label="Auto-generate names" description="Use AI to generate prompt names">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Naming template">
            <div className="h-9 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-48">
              <span className="text-body-sm text-on-surface">{"{{category}}_{{action}}"}</span>
            </div>
          </SettingRow>
        </div>
      </SettingCard>
    </SettingSection>
  </div>
);

// AI Models Section
const AIModelsSection = () => {
  const [models, setModels] = useState(MOCK_MODELS);

  const toggleModel = (id) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
  };

  return (
    <div className="space-y-6">
      <SettingSection title="Available Models" description="Enable or disable AI models for your prompts">
        <SettingCard>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr,100px,100px,80px] gap-4 px-3 py-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span>Model</span>
              <span className="text-right">Input $/1M</span>
              <span className="text-right">Output $/1M</span>
              <span className="text-center">Active</span>
            </div>
            {models.map((model, i) => (
              <div key={model.id}>
                {i > 0 && <div className="h-px bg-outline-variant" />}
                <div className="grid grid-cols-[1fr,100px,100px,80px] gap-4 px-3 py-3 items-center">
                  <div>
                    <span className="text-body-md text-on-surface font-medium">{model.name}</span>
                    <span className="text-body-sm text-on-surface-variant ml-2">{model.provider}</span>
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
      </SettingSection>

      <SettingSection title="Default Model Settings" description="Configure default parameters for new prompts">
        <SettingCard>
          <div className="space-y-4">
            <SettingRow label="Default Model">
              <div className="h-9 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-48">
                <span className="text-body-sm text-on-surface">GPT-4o</span>
              </div>
            </SettingRow>
            <div className="h-px bg-outline-variant" />
            <SettingRow label="Temperature" description="0.0 - 2.0">
              <div className="h-9 w-20 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className="text-body-sm text-on-surface">0.7</span>
              </div>
            </SettingRow>
            <div className="h-px bg-outline-variant" />
            <SettingRow label="Max Tokens">
              <div className="h-9 w-24 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
                <span className="text-body-sm text-on-surface">4096</span>
              </div>
            </SettingRow>
          </div>
        </SettingCard>
      </SettingSection>
    </div>
  );
};

// API Keys Section
const APIKeysSection = () => {
  const [showKey, setShowKey] = useState({});

  return (
    <div className="space-y-6">
      <SettingSection title="API Credentials" description="Manage your API keys and tokens securely">
        <SettingCard>
          <div className="space-y-3">
            {MOCK_API_KEYS.map((apiKey, i) => (
              <div key={apiKey.id}>
                {i > 0 && <div className="h-px bg-outline-variant my-3" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body-md text-on-surface font-medium">{apiKey.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                        {apiKey.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-body-sm text-on-surface-variant font-mono">
                        {showKey[apiKey.id] ? "sk-abc123...xyz789" : apiKey.key}
                      </code>
                      <span className="text-[10px] text-on-surface-variant">• Last used {apiKey.lastUsed}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => setShowKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                          className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                        >
                          {showKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">{showKey[apiKey.id] ? "Hide" : "Show"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                          <Copy className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">Copy</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="w-8 h-8 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]">
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

        <button className="flex items-center gap-2 h-10 px-4 text-primary hover:bg-primary/[0.08] rounded-m3-md transition-colors">
          <Plus className="h-4 w-4" />
          <span className="text-label-lg font-medium">Add API Key</span>
        </button>
      </SettingSection>
    </div>
  );
};

// Theme Section
const ThemeSection = () => {
  const [theme, setTheme] = useState("system");

  return (
    <div className="space-y-6">
      <SettingSection title="Appearance" description="Customize the look and feel of the application">
        <SettingCard>
          <div className="space-y-4">
            <span className="text-label-lg text-on-surface font-medium">Theme</span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "light", icon: Sun, label: "Light" },
                { id: "dark", icon: Moon, label: "Dark" },
                { id: "system", icon: Monitor, label: "System" },
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-m3-lg border transition-colors ${
                    theme === option.id 
                      ? "bg-primary/10 border-primary" 
                      : "border-outline-variant hover:bg-on-surface/[0.08]"
                  }`}
                >
                  <option.icon className={`h-6 w-6 ${theme === option.id ? "text-primary" : "text-on-surface-variant"}`} />
                  <span className={`text-label-md ${theme === option.id ? "text-primary font-medium" : "text-on-surface-variant"}`}>
                    {option.label}
                  </span>
                  {theme === option.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </SettingCard>
      </SettingSection>

      <SettingSection title="Accent Color" description="Choose your preferred accent color">
        <SettingCard>
          <div className="flex gap-3">
            {["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4"].map(color => (
              <button
                key={color}
                className="w-10 h-10 rounded-full border-2 border-transparent hover:border-on-surface/20 transition-colors"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </SettingCard>
      </SettingSection>
    </div>
  );
};

// Notifications Section
const NotificationsSection = () => (
  <div className="space-y-6">
    <SettingSection title="Notification Preferences" description="Control how and when you receive notifications">
      <SettingCard>
        <div className="space-y-4">
          <SettingRow label="Email notifications" description="Receive updates via email">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Cascade completion" description="Notify when cascades finish">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Error alerts" description="Get notified about failures">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Usage warnings" description="Alert when approaching limits">
            <Switch />
          </SettingRow>
        </div>
      </SettingCard>
    </SettingSection>
  </div>
);

// Profile Section
const ProfileSection = () => (
  <div className="space-y-6">
    <SettingSection title="User Profile" description="Manage your account information">
      <SettingCard>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h4 className="text-title-md text-on-surface font-semibold">John Doe</h4>
            <p className="text-body-sm text-on-surface-variant">john.doe@company.com</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm text-on-surface-variant">Display Name</label>
            <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
              <span className="text-body-md text-on-surface">John Doe</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-label-sm text-on-surface-variant">Email</label>
            <div className="h-10 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant">
              <span className="text-body-md text-on-surface">john.doe@company.com</span>
            </div>
          </div>
        </div>
      </SettingCard>
    </SettingSection>
  </div>
);

// Confluence Section
const ConfluenceSection = () => (
  <div className="space-y-6">
    <SettingSection title="Confluence Integration" description="Connect and configure Confluence">
      <SettingCard>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-m3-md bg-blue-500/10 flex items-center justify-center">
            <Link2 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-body-md text-on-surface font-medium">Connected</h4>
            <p className="text-body-sm text-on-surface-variant">mycompany.atlassian.net</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-600">Active</span>
        </div>
        <div className="space-y-4">
          <SettingRow label="Auto-sync pages" description="Sync linked pages automatically">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Default space">
            <div className="h-9 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-40">
              <span className="text-body-sm text-on-surface">Engineering</span>
            </div>
          </SettingRow>
        </div>
      </SettingCard>
    </SettingSection>
  </div>
);

// Cost Analytics Section
const CostAnalyticsSection = () => (
  <div className="space-y-6">
    <SettingSection title="Cost Overview" description="Monitor your AI usage and costs">
      <div className="grid grid-cols-2 gap-4">
        <SettingCard>
          <div className="text-center">
            <DollarSign className="h-8 w-8 mx-auto text-primary mb-2" />
            <span className="text-headline-md text-on-surface font-bold">${MOCK_COST_DATA.todayCost.toFixed(2)}</span>
            <p className="text-body-sm text-on-surface-variant">Today</p>
          </div>
        </SettingCard>
        <SettingCard>
          <div className="text-center">
            <DollarSign className="h-8 w-8 mx-auto text-primary mb-2" />
            <span className="text-headline-md text-on-surface font-bold">${MOCK_COST_DATA.monthCost.toFixed(2)}</span>
            <p className="text-body-sm text-on-surface-variant">This Month</p>
          </div>
        </SettingCard>
        <SettingCard>
          <div className="text-center">
            <span className="text-headline-md text-on-surface font-bold">{MOCK_COST_DATA.totalTokens}</span>
            <p className="text-body-sm text-on-surface-variant">Total Tokens</p>
          </div>
        </SettingCard>
        <SettingCard>
          <div className="text-center">
            <span className="text-headline-md text-on-surface font-bold">${MOCK_COST_DATA.avgCostPerPrompt}</span>
            <p className="text-body-sm text-on-surface-variant">Avg/Prompt</p>
          </div>
        </SettingCard>
      </div>
    </SettingSection>
  </div>
);

// Workbench Settings Section
const WorkbenchSettingsSection = () => (
  <div className="space-y-6">
    <SettingSection title="Workbench Preferences" description="Configure the workbench chat interface">
      <SettingCard>
        <div className="space-y-4">
          <SettingRow label="Default model" description="Model used for new conversations">
            <div className="h-9 px-3 flex items-center bg-surface-container rounded-m3-sm border border-outline-variant min-w-40">
              <span className="text-body-sm text-on-surface">GPT-4o</span>
            </div>
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Enable file search" description="Allow searching uploaded files">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Enable code interpreter" description="Allow code execution">
            <Switch />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Auto-save threads" description="Save conversation history">
            <Switch defaultChecked />
          </SettingRow>
        </div>
      </SettingCard>
    </SettingSection>
  </div>
);

// New UI Section
const NewUISection = () => (
  <div className="space-y-6">
    <SettingSection title="New UI (Beta)" description="Try the experimental new interface">
      <SettingCard>
        <div className="flex items-center gap-4 p-2 mb-4 bg-amber-500/10 rounded-m3-md">
          <Sparkles className="h-5 w-5 text-amber-600" />
          <span className="text-body-sm text-amber-700">You're currently using the new UI</span>
        </div>
        <div className="space-y-4">
          <SettingRow label="Enable New UI" description="Switch to the experimental interface">
            <Switch defaultChecked />
          </SettingRow>
          <div className="h-px bg-outline-variant" />
          <SettingRow label="Show onboarding tips" description="Display helpful hints for new features">
            <Switch defaultChecked />
          </SettingRow>
        </div>
      </SettingCard>
    </SettingSection>
  </div>
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
      <div className="h-14 flex items-center gap-3 px-6 border-b border-outline-variant" style={{ height: "56px" }}>
        <Icon className="h-5 w-5 text-on-surface-variant" />
        <h2 className="text-title-md text-on-surface font-semibold">{section.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl">
          <SectionComponent />
        </div>
      </div>
    </div>
  );
};

export default MockupSettingsContent;
