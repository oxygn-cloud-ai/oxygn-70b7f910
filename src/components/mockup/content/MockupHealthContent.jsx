import React from "react";
import { 
  Activity, Server, Zap, Shield, Key, Globe, 
  CheckCircle, AlertCircle, XCircle, Clock, 
  Database, Cpu, HardDrive, Wifi, RefreshCw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Status types and colors
const STATUS = {
  operational: { color: "bg-green-500", text: "text-green-600", bg: "bg-green-500/10", label: "Operational" },
  degraded: { color: "bg-yellow-500", text: "text-yellow-600", bg: "bg-yellow-500/10", label: "Degraded" },
  down: { color: "bg-red-500", text: "text-red-600", bg: "bg-red-500/10", label: "Down" },
  unknown: { color: "bg-gray-500", text: "text-gray-600", bg: "bg-gray-500/10", label: "Unknown" },
};

// Mock data
const OVERVIEW_DATA = {
  database: { status: "operational", latency: "23ms", uptime: "99.99%" },
  ai: { status: "operational", latency: "145ms", uptime: "99.95%" },
  auth: { status: "operational", sessions: "156 active" },
  api: { status: "operational", requests: "1.2K/min" },
  storage: { status: "operational", used: "2.4GB / 10GB" },
  functions: { status: "operational", invocations: "847/hr" },
};

const DATABASE_TABLES = [
  { name: "q_prompts", rows: 1247, status: "operational", lastSync: "2 min ago" },
  { name: "q_templates", rows: 89, status: "operational", lastSync: "5 min ago" },
  { name: "q_threads", rows: 567, status: "operational", lastSync: "1 min ago" },
  { name: "q_workbench_messages", rows: 3421, status: "operational", lastSync: "30 sec ago" },
  { name: "q_ai_costs", rows: 8934, status: "operational", lastSync: "1 min ago" },
  { name: "profiles", rows: 23, status: "operational", lastSync: "1 hr ago" },
];

const AI_MODELS_STATUS = [
  { name: "GPT-4o", status: "operational", latency: "142ms", availability: "99.98%" },
  { name: "GPT-4o Mini", status: "operational", latency: "89ms", availability: "99.99%" },
  { name: "O1 Preview", status: "operational", latency: "3.2s", availability: "99.90%" },
  { name: "O1 Mini", status: "operational", latency: "1.8s", availability: "99.95%" },
];

const API_ENDPOINTS = [
  { name: "openai-proxy", status: "operational", latency: "145ms", calls: "423/hr" },
  { name: "conversation-run", status: "operational", latency: "234ms", calls: "156/hr" },
  { name: "confluence-manager", status: "operational", latency: "189ms", calls: "67/hr" },
  { name: "workbench-chat", status: "operational", latency: "178ms", calls: "289/hr" },
];

const ENV_VARIABLES = [
  { name: "OPENAI_API_KEY", status: "set", masked: "sk-...xyz7" },
  { name: "SUPABASE_URL", status: "set", masked: "https://...supabase.co" },
  { name: "SUPABASE_ANON_KEY", status: "set", masked: "eyJ...abc" },
  { name: "CONFLUENCE_TOKEN", status: "set", masked: "ATATT...9kLm" },
];

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
      {s.label}
    </span>
  );
};

const HealthCard = ({ icon: Icon, title, status, children }) => (
  <div className="p-3 bg-surface-container-low rounded-m3-lg">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-on-surface-variant" />
        <span className="text-label-sm text-on-surface font-medium">{title}</span>
      </div>
      <StatusBadge status={status} />
    </div>
    {children}
  </div>
);

// Overview Section
const OverviewSection = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <HealthCard icon={Database} title="Database" status={OVERVIEW_DATA.database.status}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Latency</span>
          <span className="text-on-surface">{OVERVIEW_DATA.database.latency}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] mt-1">
          <span className="text-on-surface-variant">Uptime</span>
          <span className="text-on-surface">{OVERVIEW_DATA.database.uptime}</span>
        </div>
      </HealthCard>

      <HealthCard icon={Zap} title="AI Services" status={OVERVIEW_DATA.ai.status}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Latency</span>
          <span className="text-on-surface">{OVERVIEW_DATA.ai.latency}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] mt-1">
          <span className="text-on-surface-variant">Uptime</span>
          <span className="text-on-surface">{OVERVIEW_DATA.ai.uptime}</span>
        </div>
      </HealthCard>

      <HealthCard icon={Shield} title="Authentication" status={OVERVIEW_DATA.auth.status}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Sessions</span>
          <span className="text-on-surface">{OVERVIEW_DATA.auth.sessions}</span>
        </div>
      </HealthCard>

      <HealthCard icon={Globe} title="API" status={OVERVIEW_DATA.api.status}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Requests</span>
          <span className="text-on-surface">{OVERVIEW_DATA.api.requests}</span>
        </div>
      </HealthCard>

      <HealthCard icon={HardDrive} title="Storage" status={OVERVIEW_DATA.storage.status}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Usage</span>
          <span className="text-on-surface">{OVERVIEW_DATA.storage.used}</span>
        </div>
      </HealthCard>

      <HealthCard icon={Cpu} title="Edge Functions" status={OVERVIEW_DATA.functions.status}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant">Invocations</span>
          <span className="text-on-surface">{OVERVIEW_DATA.functions.invocations}</span>
        </div>
      </HealthCard>
    </div>
  </div>
);

// Database Section
const DatabaseSection = () => (
  <div className="space-y-4">
    <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
      <div className="grid grid-cols-[1fr,80px,100px,100px] gap-3 px-3 py-2 bg-surface-container text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
        <span>Table</span>
        <span className="text-right">Rows</span>
        <span className="text-center">Status</span>
        <span className="text-right">Last Sync</span>
      </div>
      {DATABASE_TABLES.map((table, i) => (
        <div key={table.name} className={`grid grid-cols-[1fr,80px,100px,100px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
          <span className="text-body-sm text-on-surface font-mono">{table.name}</span>
          <span className="text-body-sm text-on-surface-variant text-right">{table.rows.toLocaleString()}</span>
          <div className="flex justify-center">
            <StatusBadge status={table.status} />
          </div>
          <span className="text-[11px] text-on-surface-variant text-right">{table.lastSync}</span>
        </div>
      ))}
    </div>
  </div>
);

// AI Services Section
const AIServicesSection = () => (
  <div className="space-y-4">
    <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
      <div className="grid grid-cols-[1fr,100px,100px,100px] gap-3 px-3 py-2 bg-surface-container text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
        <span>Model</span>
        <span className="text-center">Status</span>
        <span className="text-right">Latency</span>
        <span className="text-right">Availability</span>
      </div>
      {AI_MODELS_STATUS.map((model, i) => (
        <div key={model.name} className={`grid grid-cols-[1fr,100px,100px,100px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
          <span className="text-body-sm text-on-surface font-medium">{model.name}</span>
          <div className="flex justify-center">
            <StatusBadge status={model.status} />
          </div>
          <span className="text-body-sm text-on-surface-variant text-right">{model.latency}</span>
          <span className="text-body-sm text-on-surface-variant text-right">{model.availability}</span>
        </div>
      ))}
    </div>
  </div>
);

// Auth Status Section
const AuthStatusSection = () => (
  <div className="space-y-4">
    <div className="p-4 bg-surface-container-low rounded-m3-lg">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="h-5 w-5 text-green-600" />
        <div>
          <h4 className="text-body-sm text-on-surface font-medium">Authenticated</h4>
          <p className="text-[11px] text-on-surface-variant">Session active and valid</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between py-2 border-b border-outline-variant">
          <span className="text-body-sm text-on-surface-variant">User</span>
          <span className="text-body-sm text-on-surface">john.doe@company.com</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-outline-variant">
          <span className="text-body-sm text-on-surface-variant">Session Started</span>
          <span className="text-body-sm text-on-surface">2 hours ago</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-outline-variant">
          <span className="text-body-sm text-on-surface-variant">Token Expires</span>
          <span className="text-body-sm text-on-surface">in 22 hours</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-body-sm text-on-surface-variant">MFA Status</span>
          <span className="text-body-sm text-green-600">Enabled</span>
        </div>
      </div>
    </div>
  </div>
);

// API Health Section
const APIHealthSection = () => (
  <div className="space-y-4">
    <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
      <div className="grid grid-cols-[1fr,100px,100px,100px] gap-3 px-3 py-2 bg-surface-container text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
        <span>Endpoint</span>
        <span className="text-center">Status</span>
        <span className="text-right">Latency</span>
        <span className="text-right">Calls/hr</span>
      </div>
      {API_ENDPOINTS.map((endpoint, i) => (
        <div key={endpoint.name} className={`grid grid-cols-[1fr,100px,100px,100px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
          <span className="text-body-sm text-on-surface font-mono">{endpoint.name}</span>
          <div className="flex justify-center">
            <StatusBadge status={endpoint.status} />
          </div>
          <span className="text-body-sm text-on-surface-variant text-right">{endpoint.latency}</span>
          <span className="text-body-sm text-on-surface-variant text-right">{endpoint.calls}</span>
        </div>
      ))}
    </div>
  </div>
);

// Environment Section
const EnvironmentSection = () => (
  <div className="space-y-4">
    <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
      <div className="grid grid-cols-[1fr,80px,180px] gap-3 px-3 py-2 bg-surface-container text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
        <span>Variable</span>
        <span className="text-center">Status</span>
        <span>Value</span>
      </div>
      {ENV_VARIABLES.map((envVar, i) => (
        <div key={envVar.name} className={`grid grid-cols-[1fr,80px,180px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
          <span className="text-body-sm text-on-surface font-mono">{envVar.name}</span>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-600">
              <CheckCircle className="h-3 w-3" />
              Set
            </span>
          </div>
          <span className="text-[11px] text-on-surface-variant font-mono">{envVar.masked}</span>
        </div>
      ))}
    </div>
  </div>
);

const HEALTH_SECTIONS = {
  overview: { component: OverviewSection, icon: Activity, title: "Overview" },
  database: { component: DatabaseSection, icon: Server, title: "Database" },
  "ai-services": { component: AIServicesSection, icon: Zap, title: "AI Services" },
  "auth-status": { component: AuthStatusSection, icon: Shield, title: "Auth Status" },
  "api-health": { component: APIHealthSection, icon: Key, title: "API Health" },
  environment: { component: EnvironmentSection, icon: Globe, title: "Environment" },
};

const MockupHealthContent = ({ activeSubItem = "overview" }) => {
  const section = HEALTH_SECTIONS[activeSubItem] || HEALTH_SECTIONS.overview;
  const SectionComponent = section.component;
  const Icon = section.icon;

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant" style={{ height: "56px" }}>
        <Icon className="h-5 w-5 text-on-surface-variant" />
        <h2 className="text-title-sm text-on-surface font-medium">{section.title}</h2>
        <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl">
          <SectionComponent />
        </div>
      </div>
    </div>
  );
};

export default MockupHealthContent;