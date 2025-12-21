import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useModels } from '../hooks/useModels';
import { useModelDefaults } from '../hooks/useModelDefaults';
import { useSupabase } from '../hooks/useSupabase';
import { toast } from '@/components/ui/sonner';
import { useSettingsSection } from '../App';
import { QonsolSettingsSection } from '../components/settings/QonsolSettingsSection';
import { PromptNamingSection } from '../components/settings/PromptNamingSection';
import { AIModelsSection } from '../components/settings/AIModelsSection';
import { DatabaseEnvironmentSection } from '../components/settings/DatabaseEnvironmentSection';
import { ConversationDefaultsSection } from '../components/settings/ConversationDefaultsSection';
import { OpenAIAssistantsSection } from '../components/settings/OpenAIAssistantsSection';
import ConfluenceSettingsSection from '../components/settings/ConfluenceSettingsSection';
import CostAnalyticsSection from '../components/settings/CostAnalyticsSection';
import AppearanceSection from '../components/settings/AppearanceSection';

const MAX_SETTING_VALUE_LENGTH = 500000;

const Settings = () => {
  const supabase = useSupabase();
  const { settings, updateSetting, addSetting, deleteSetting, isLoading, error, refetch } = useSettings(supabase);
  const [editedValues, setEditedValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { activeSection } = useSettingsSection();

  const { models, isLoading: modelsLoading, toggleModelActive, addModel, deleteModel, refetch: refetchModels } = useModels();
  const { modelDefaults, updateModelDefault, refetch: refetchModelDefaults } = useModelDefaults();

  useEffect(() => {
    const onFocus = () => {
      refetch?.();
      refetchModels?.();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch, refetchModels]);

  if (isLoading || !supabase) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">Error loading settings: {error.message}</div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchModels(), refetchModelDefaults()]);
      toast.success('Settings refreshed');
    } catch (err) {
      toast.error('Failed to refresh settings');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleValueChange = (key, value) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    const nextValue = editedValues[key];
    if (nextValue === undefined) return;

    if (String(nextValue).length > MAX_SETTING_VALUE_LENGTH) {
      toast.error(`Value is too long (max ${MAX_SETTING_VALUE_LENGTH} characters)`);
      return;
    }

    setIsSaving(true);
    try {
      await updateSetting(key, nextValue);
      setEditedValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
      toast.success(`Setting "${key}" saved`);
    } catch (err) {
      toast.error('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSetting = async (key) => {
    try {
      await deleteSetting(key);
      toast.success(`Setting "${key}" deleted`);
    } catch (err) {
      toast.error('Failed to delete setting');
    }
  };

  const handleAddSecret = (secretName) => {
    toast.info(`To add secret "${secretName}", use the Lovable Cloud secrets management in the project settings.`, {
      duration: 5000,
    });
  };

  const handleUpdateSecret = (secretName) => {
    toast.info(`To update secret "${secretName}", use the Lovable Cloud secrets management in the project settings.`, {
      duration: 5000,
    });
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'qonsol':
        return (
          <QonsolSettingsSection
            settings={settings}
            models={models}
            editedValues={editedValues}
            isSaving={isSaving}
            isRefreshing={isRefreshing}
            onValueChange={handleValueChange}
            onSave={handleSave}
            onRefresh={handleRefresh}
          />
        );
      case 'naming':
        return (
          <PromptNamingSection
            settings={settings}
            updateSetting={updateSetting}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'models':
        return (
          <AIModelsSection
            models={models}
            modelsLoading={modelsLoading}
            modelDefaults={modelDefaults}
            toggleModelActive={toggleModelActive}
            addModel={addModel}
            deleteModel={deleteModel}
            updateModelDefault={updateModelDefault}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'database':
        return (
          <DatabaseEnvironmentSection
            settings={settings}
            editedValues={editedValues}
            isSaving={isSaving}
            isRefreshing={isRefreshing}
            onValueChange={handleValueChange}
            onSave={handleSave}
            onAddSetting={addSetting}
            onDeleteSetting={handleDeleteSetting}
            onRefresh={handleRefresh}
            onAddSecret={handleAddSecret}
            onUpdateSecret={handleUpdateSecret}
          />
        );
      case 'assistants':
        return (
          <ConversationDefaultsSection
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'openai-assistants':
        return (
          <OpenAIAssistantsSection
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'confluence':
        return (
          <ConfluenceSettingsSection
            settings={settings}
            editedValues={editedValues}
            onValueChange={handleValueChange}
            onSave={handleSave}
            isSaving={isSaving}
          />
        );
      case 'cost-analytics':
        return <CostAnalyticsSection />;
      case 'appearance':
        return <AppearanceSection />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      {renderActiveSection()}
    </div>
  );
};

export default Settings;