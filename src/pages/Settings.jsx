import React, { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import SettingField from '../components/SettingField';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

const Settings = () => {
  const supabase = useSupabase();
  const { settings, updateSetting, isLoading, error } = useSettings(supabase);
  const [localSettings, setLocalSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  if (isLoading || !supabase) {
    return <div>Loading settings...</div>;
  }

  if (error) {
    return <div>Error loading settings: {error.message}</div>;
  }

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [key, value] of Object.entries(localSettings)) {
        if (value !== settings[key]) {
          await updateSetting(key, value);
        }
      }
      setHasChanges(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const settingsFields = [
    { key: 'build', label: 'Build', type: 'text' },
    { key: 'version', label: 'Version', type: 'text' },
    { key: 'def_admin_prompt', label: 'Default Admin Prompt', type: 'textarea' },
  ];

  return (
    <div className="container mx-auto p-4">
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          {settingsFields.map(({ key, label, type }) => (
            <SettingField
              key={key}
              id={key}
              label={label}
              type={type}
              value={localSettings[key] || ''}
              onChange={(value) => handleChange(key, value)}
            />
          ))}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Debug</label>
            <input
              type="text"
              value={import.meta.env.VITE_DEBUG || 'NULL'}
              readOnly
              className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-600"
            />
          </div>
        </div>
        <div className="mt-6">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="relative"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;