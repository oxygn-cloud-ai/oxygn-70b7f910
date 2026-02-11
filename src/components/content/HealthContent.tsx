/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { 
  Activity, Server, Zap, Shield, Key, Globe,
  Database, RefreshCw, Loader2, CloudCog, Wrench
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAllResourceHealth } from "@/hooks/useResourceHealth";
import { toast } from "@/components/ui/sonner";
import type { LucideIcon } from 'lucide-react';

// Status types and colors
const STATUS: Record<string, { color: string; text: string; bg: string; label: string }> = {
  operational: { color: "bg-green-500", text: "text-green-600", bg: "bg-green-500/10", label: "Operational" },
  success: { color: "bg-green-500", text: "text-green-600", bg: "bg-green-500/10", label: "Success" },
  authenticated: { color: "bg-green-500", text: "text-green-600", bg: "bg-green-500/10", label: "Authenticated" },
  degraded: { color: "bg-yellow-500", text: "text-yellow-600", bg: "bg-yellow-500/10", label: "Degraded" },
  down: { color: "bg-red-500", text: "text-red-600", bg: "bg-red-500/10", label: "Down" },
  error: { color: "bg-red-500", text: "text-red-600", bg: "bg-red-500/10", label: "Error" },
  unknown: { color: "bg-gray-500", text: "text-gray-600", bg: "bg-gray-500/10", label: "Unknown" },
  pending: { color: "bg-gray-500", text: "text-gray-600", bg: "bg-gray-500/10", label: "Checking..." },
  unauthenticated: { color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-500/10", label: "Not Logged In" },
};

const DATABASE_TABLES = [
  "q_prompts",
  "q_templates",
  "q_threads",
  "q_ai_costs",
  "profiles",
];

const API_ENDPOINTS = [
  { name: "openai-proxy", description: "OpenAI Proxy" },
];


const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS[status] || STATUS.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
      {s.label}
    </span>
  );
};

interface HealthCardProps {
  icon: LucideIcon;
  title: string;
  status: string;
  children: React.ReactNode;
}

const HealthCard = ({ icon: Icon, title, status, children }: HealthCardProps) => (
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

interface SectionProps {
  healthData: any;
  isLoading: boolean;
}

// Overview Section with real data
const OverviewSection = ({ healthData, isLoading }: SectionProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <HealthCard icon={Database} title="Database" status={healthData.database.status}>
          <div className="flex items-center justify-between text-tree">
            <span className="text-on-surface-variant">Status</span>
            <span className="text-on-surface">{healthData.database.message}</span>
          </div>
        </HealthCard>

        <HealthCard icon={Zap} title="AI Services" status={healthData.openai.connection.status}>
          <div className="flex items-center justify-between text-tree">
            <span className="text-on-surface-variant">Latency</span>
            <span className="text-on-surface">{healthData.openai.connection.latency ? `${healthData.openai.connection.latency}ms` : 'N/A'}</span>
          </div>
        </HealthCard>

        <HealthCard icon={Shield} title="Authentication" status={healthData.auth.status}>
          <div className="flex items-center justify-between text-tree">
            <span className="text-on-surface-variant">User</span>
            <span className="text-on-surface truncate max-w-32">{healthData.auth.user?.email || 'Not logged in'}</span>
          </div>
        </HealthCard>

        <HealthCard icon={Globe} title="Edge Functions" status={healthData.openai.connection.status}>
          <div className="flex items-center justify-between text-tree">
            <span className="text-on-surface-variant">Status</span>
            <span className="text-on-surface">{healthData.openai.connection.message}</span>
          </div>
        </HealthCard>
      </div>
    </div>
  );
};

// Database Section with real table checks
const DatabaseSection = ({ healthData, isLoading }: SectionProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-surface-container-low rounded-m3-lg">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-4 w-4 text-on-surface-variant" />
          <span className="text-label-sm text-on-surface font-medium">Connection</span>
          <StatusBadge status={healthData.database.status} />
        </div>
        <p className="text-tree text-on-surface-variant">{healthData.database.message}</p>
      </div>
      
      <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,80px,100px] gap-3 px-3 py-2 bg-surface-container text-compact text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
          <span>Table</span>
          <span className="text-right">Rows</span>
          <span className="text-center">Status</span>
        </div>
        {DATABASE_TABLES.map((tableName, i) => {
          const tableData = healthData.tables?.[tableName] || { status: 'pending', count: 0 };
          return (
            <div key={tableName} className={`grid grid-cols-[1fr,80px,100px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
              <span className="text-body-sm text-on-surface font-mono">{tableName}</span>
              <span className="text-body-sm text-on-surface-variant text-right">{(tableData.count || 0).toLocaleString()}</span>
              <div className="flex justify-center">
                <StatusBadge status={tableData.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// AI Services Section 
const AIServicesSection = ({ healthData, isLoading }: SectionProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  const models = healthData.openai?.models?.available || [];

  return (
    <div className="space-y-4">
      <div className="p-3 bg-surface-container-low rounded-m3-lg">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-on-surface-variant" />
          <span className="text-label-sm text-on-surface font-medium">OpenAI Connection</span>
          <StatusBadge status={healthData.openai?.connection?.status || 'pending'} />
        </div>
        <p className="text-tree text-on-surface-variant">{healthData.openai?.connection?.message}</p>
        {healthData.openai?.connection?.latency && (
          <p className="text-tree text-on-surface-variant mt-1">Latency: {healthData.openai.connection.latency}ms</p>
        )}
      </div>
      
      {models.length > 0 && (
        <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
          <div className="grid grid-cols-[1fr,100px] gap-3 px-3 py-2 bg-surface-container text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
            <span>Available Models</span>
            <span className="text-center">Status</span>
          </div>
          {models.slice(0, 8).map((model: string, i: number) => (
            <div key={model} className={`grid grid-cols-[1fr,100px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
              <span className="text-body-sm text-on-surface font-medium">{model}</span>
              <div className="flex justify-center">
                <StatusBadge status="success" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Auth Status Section
const AuthStatusSection = ({ healthData, isLoading }: SectionProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  const isAuthenticated = healthData.auth?.status === 'authenticated';
  const user = healthData.auth?.user;

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface-container-low rounded-m3-lg">
        <div className="flex items-center gap-3 mb-4">
          <Shield className={`h-5 w-5 ${isAuthenticated ? 'text-green-600' : 'text-amber-600'}`} />
          <div>
            <h4 className="text-body-sm text-on-surface font-medium">
              {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </h4>
            <p className="text-tree text-on-surface-variant">{healthData.auth?.message}</p>
          </div>
        </div>

        {isAuthenticated && user && (
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-outline-variant">
              <span className="text-body-sm text-on-surface-variant">Email</span>
              <span className="text-body-sm text-on-surface">{user.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-outline-variant">
              <span className="text-body-sm text-on-surface-variant">User ID</span>
              <span className="text-body-sm text-on-surface font-mono text-[10px]">{user.id?.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body-sm text-on-surface-variant">Role</span>
              <span className="text-body-sm text-on-surface">{user.role || 'user'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// API Health Section
const APIHealthSection = ({ healthData, isLoading }: SectionProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,100px,150px] gap-3 px-3 py-2 bg-surface-container text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
          <span>Endpoint</span>
          <span className="text-center">Status</span>
          <span className="text-right">Message</span>
        </div>
        {API_ENDPOINTS.map((endpoint, i) => (
          <div key={endpoint.name} className={`grid grid-cols-[1fr,100px,150px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
            <div>
              <span className="text-body-sm text-on-surface font-mono">{endpoint.name}</span>
              <p className="text-[10px] text-on-surface-variant">{endpoint.description}</p>
            </div>
            <div className="flex justify-center">
              <StatusBadge status={healthData.openai?.connection?.status || 'pending'} />
            </div>
            <span className="text-tree text-on-surface-variant text-right truncate">
              {healthData.openai?.connection?.message || 'Checking...'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// OpenAI Resources Section
const ResourcesSection = () => {
  const { assistants, isChecking, error, checkAll, repairAssistant } = useAllResourceHealth() as any;
  const [repairingId, setRepairingId] = useState<string | null>(null);

  useEffect(() => {
    checkAll();
  }, []);

  const handleRepair = async (assistantRowId: string) => {
    setRepairingId(assistantRowId);
    try {
      const result = await repairAssistant(assistantRowId);
      if (result?.success) {
        toast.success('Resources repaired successfully');
      } else {
        toast.error('Repair completed with errors', { description: result?.errors?.join(', ') });
      }
    } catch (err: any) {
      toast.error('Repair failed', { description: err.message });
    } finally {
      setRepairingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'degraded';
      case 'broken': return 'error';
      default: return 'unknown';
    }
  };

  if (isChecking && assistants.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 rounded-m3-lg text-red-600">
        <p className="text-body-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-surface-container-low rounded-m3-lg">
        <div className="flex items-center gap-2 mb-2">
          <CloudCog className="h-4 w-4 text-on-surface-variant" />
          <span className="text-label-sm text-on-surface font-medium">OpenAI Resources</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => checkAll()}
                disabled={isChecking}
                className="ml-auto w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Check All</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-tree text-on-surface-variant">
          {assistants.length} assistant(s) with vector stores and files
        </p>
      </div>

      {assistants.length === 0 ? (
        <div className="p-4 bg-surface-container-low rounded-m3-lg text-center">
          <p className="text-body-sm text-on-surface-variant">No assistants configured</p>
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-m3-lg overflow-hidden">
          <div className="grid grid-cols-[1fr,100px,80px,80px,60px] gap-3 px-3 py-2 bg-surface-container text-compact text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
            <span>Assistant</span>
            <span className="text-center">Status</span>
            <span className="text-center">Vector Store</span>
            <span className="text-center">Files</span>
            <span className="text-center">Action</span>
          </div>
          {assistants.map((assistant: any, i: number) => (
            <div key={assistant.assistant_row_id} className={`grid grid-cols-[1fr,100px,80px,80px,60px] gap-3 px-3 py-2 items-center ${i > 0 ? "border-t border-outline-variant" : ""}`}>
              <div className="min-w-0">
                <span className="text-body-sm text-on-surface font-medium truncate block">{assistant.prompt_name}</span>
                <span className="text-[10px] text-on-surface-variant truncate block">{assistant.assistant_name}</span>
              </div>
              <div className="flex justify-center">
                <StatusBadge status={getStatusBadge(assistant.status)} />
              </div>
              <div className="flex justify-center">
                <StatusBadge status={assistant.vector_store.status === 'exists' ? 'success' : assistant.vector_store.status === 'missing' ? 'error' : 'unknown'} />
              </div>
              <div className="text-center text-body-sm text-on-surface">
                {assistant.files.healthy}/{assistant.files.total_in_db}
              </div>
              <div className="flex justify-center">
                {assistant.status !== 'healthy' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => handleRepair(assistant.assistant_row_id)}
                        disabled={repairingId === assistant.assistant_row_id}
                        className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                      >
                        {repairingId === assistant.assistant_row_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wrench className="h-4 w-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Repair</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main HealthContent component
interface HealthContentProps {
  activeSubItem?: string;
}

const HealthContent = ({ activeSubItem }: HealthContentProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>({
    database: { status: 'pending', message: '' },
    tables: {},
    auth: { status: 'pending', message: '', user: null },
    openai: {
      apiKey: { status: 'pending', message: '' },
      connection: { status: 'pending', message: '', latency: null },
      models: { status: 'pending', available: [] },
    },
  });

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Check database connection
      const dbStart = Date.now();
      const { error: dbError } = await supabase.from('q_prompts').select('count').limit(1);
      const dbLatency = Date.now() - dbStart;
      const dbResult = dbError 
        ? { status: 'error', message: dbError.message }
        : { status: 'success', message: `Connected (${dbLatency}ms)` };

      // Check tables
      const tableResults: Record<string, any> = {};
      for (const table of DATABASE_TABLES) {
        try {
          const { count } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
          tableResults[table] = { status: 'success', count: count || 0 };
        } catch {
          tableResults[table] = { status: 'error', count: 0 };
        }
      }

      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      const authResult = session?.user 
        ? { status: 'authenticated', message: `Logged in as ${session.user.email}`, user: session.user }
        : { status: 'unauthenticated', message: 'No active session', user: null };

      // Check OpenAI via edge function
      const openaiResult: any = { connection: { status: 'pending', message: 'Not checked', latency: null }, models: { status: 'pending', available: [] } };
      try {
        const { data, error } = await supabase.functions.invoke('openai-proxy', { body: { action: 'health' } });
        if (error) {
          openaiResult.connection = { status: 'error', message: error.message, latency: null };
        } else {
          openaiResult.connection = { status: data.status || 'success', message: data.message || 'Connected', latency: data.latency };
        }
      } catch (err: any) {
        openaiResult.connection = { status: 'error', message: err.message, latency: null };
      }

      // Check OpenAI models
      try {
        const { data: modelsData, error: modelsError } = await supabase.functions.invoke('openai-proxy', { body: { action: 'models' } });
        if (!modelsError && modelsData) {
          openaiResult.models = { status: 'success', available: modelsData.available || [] };
        }
      } catch {
        // Models check failed silently
      }

      setHealthData({
        database: dbResult,
        tables: tableResults,
        auth: authResult,
        openai: openaiResult,
      });
    } catch (error) {
      console.error('Health check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const HEALTH_SECTIONS: Record<string, { component: React.FC<SectionProps> | React.FC; icon: LucideIcon; title: string }> = {
    overview: { component: OverviewSection, icon: Activity, title: "Overview" },
    database: { component: DatabaseSection, icon: Server, title: "Database" },
    "ai-services": { component: AIServicesSection, icon: Zap, title: "AI Services" },
    resources: { component: ResourcesSection, icon: CloudCog, title: "OpenAI Resources" },
    "auth-status": { component: AuthStatusSection, icon: Shield, title: "Auth Status" },
    "api-health": { component: APIHealthSection, icon: Key, title: "API Health" },
  };

  const section = HEALTH_SECTIONS[activeSubItem || 'overview'] || HEALTH_SECTIONS.overview;
  const SectionComponent = section.component as any;
  const Icon = section.icon;

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant" style={{ height: "56px" }}>
        <Icon className="h-5 w-5 text-on-surface-variant" />
        <h2 className="text-title-sm text-on-surface font-medium">{section.title}</h2>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={checkHealth}
                disabled={isLoading}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Refresh</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl">
          <SectionComponent healthData={healthData} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default HealthContent;
