import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHealthSection } from '../App';
import DatabaseSection from '../components/health/DatabaseSection';
import AuthSection from '../components/health/AuthSection';
import AISection from '../components/health/AISection';
import EnvironmentSection from '../components/health/EnvironmentSection';

const REQUIRED_TABLES = [
  // Core tables from env
  import.meta.env.VITE_PROMPTS_TBL,
  import.meta.env.VITE_SETTINGS_TBL,
  import.meta.env.VITE_MODELS_TBL,
  import.meta.env.VITE_PROJECTS_TBL || 'projects',
  // All q_ tables
  'q_ai_costs',
  'q_assistant_files',
  'q_assistant_tool_defaults',
  'q_assistants',
  'q_backups',
  'q_confluence_pages',
  'q_model_defaults',
  'q_model_pricing',
  'q_models',
  'q_prompt_library',
  'q_prompt_variables',
  'q_prompts',
  'q_settings',
  'q_templates',
  'q_threads',
  'q_vector_stores',
  'q_workbench_confluence_links',
  'q_workbench_files',
  'q_workbench_messages',
  'q_workbench_threads',
  // Other tables
  'profiles',
  'projects',
  'resource_shares',
  'user_roles',
].filter(Boolean);

const HealthCheck = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({
    database: { status: 'pending', message: '' },
    tables: {},
    auth: { status: 'pending', message: '', user: null },
    openai: {
      apiKey: { status: 'pending', message: '' },
      apiUrl: { status: 'pending', message: '' },
      connection: { status: 'pending', message: '', latency: null },
      models: { status: 'pending', message: '', available: [] },
    },
  });

  const { activeSection } = useHealthSection();

  const checkDatabaseConnection = async () => {
    try {
      const start = Date.now();
      const { error } = await supabase.from(REQUIRED_TABLES[0]).select('count').limit(1);
      const latency = Date.now() - start;
      
      if (error && !error.message.includes('does not exist')) {
        return { status: 'error', message: `Connection failed: ${error.message}` };
      }
      return { status: 'success', message: `Connected (${latency}ms)` };
    } catch (err) {
      return { status: 'error', message: `Connection error: ${err.message}` };
    }
  };

  const checkTable = async (tableName) => {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          return { status: 'missing', message: 'Table does not exist', count: 0 };
        }
        return { status: 'error', message: error.message, count: 0 };
      }
      
      const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      return { status: 'success', message: 'Table exists', count: count || 0 };
    } catch (err) {
      return { status: 'error', message: err.message, count: 0 };
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return { status: 'error', message: error.message, user: null };
      }
      
      if (session?.user) {
        return { 
          status: 'authenticated', 
          message: `Logged in as ${session.user.email}`,
          user: session.user 
        };
      }
      
      return { status: 'unauthenticated', message: 'No active session', user: null };
    } catch (err) {
      return { status: 'error', message: err.message, user: null };
    }
  };

  const checkOpenAIConfig = () => {
    return { 
      apiKey: { status: 'success', message: 'Managed via edge function secret' },
      apiUrl: { status: 'success', message: 'https://api.openai.com/v1/chat/completions' }
    };
  };

  const checkOpenAIConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action: 'health' }
      });

      if (error) {
        console.error('Edge function error:', error);
        return { status: 'error', message: `Edge function error: ${error.message}`, latency: null };
      }

      return {
        status: data.status || 'error',
        message: data.message || 'Unknown response',
        latency: data.latency || null
      };
    } catch (err) {
      console.error('Connection check error:', err);
      return { status: 'error', message: `Connection failed: ${err.message}`, latency: null };
    }
  };

  const checkOpenAIModels = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action: 'models' }
      });

      if (error) {
        console.error('Edge function error:', error);
        return { status: 'error', message: `Edge function error: ${error.message}`, available: [] };
      }

      return {
        status: data.status || 'error',
        message: data.message || 'Unknown response',
        available: data.available || []
      };
    } catch (err) {
      console.error('Models check error:', err);
      return { status: 'error', message: `Failed: ${err.message}`, available: [] };
    }
  };

  const runHealthCheck = async () => {
    setIsLoading(true);
    
    const [dbResult, authResult] = await Promise.all([
      checkDatabaseConnection(),
      checkAuth(),
    ]);

    const tableResults = {};
    for (const table of REQUIRED_TABLES) {
      tableResults[table] = await checkTable(table);
    }

    const openaiConfig = checkOpenAIConfig();
    const [openaiConnection, openaiModels] = await Promise.all([
      checkOpenAIConnection(),
      checkOpenAIModels(),
    ]);

    setResults({
      database: dbResult,
      tables: tableResults,
      auth: authResult,
      openai: {
        apiKey: openaiConfig.apiKey,
        apiUrl: openaiConfig.apiUrl,
        connection: openaiConnection,
        models: openaiModels,
      },
    });
    
    setIsLoading(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'database':
        return (
          <DatabaseSection
            results={results}
            tables={REQUIRED_TABLES}
            isLoading={isLoading}
            onRefresh={runHealthCheck}
          />
        );
      case 'auth':
        return (
          <AuthSection
            results={results}
            isLoading={isLoading}
            onRefresh={runHealthCheck}
          />
        );
      case 'ai':
        return (
          <AISection
            results={results}
            isLoading={isLoading}
            onRefresh={runHealthCheck}
          />
        );
      case 'environment':
        return (
          <EnvironmentSection
            isLoading={isLoading}
            onRefresh={runHealthCheck}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      {renderActiveSection()}
    </div>
  );
};

export default HealthCheck;
