import React, { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import SettingField from '../components/SettingField';
import { Button } from "@/components/ui/button";

const Settings = () => {
  const supabase = useSupabase();
  const { settings, updateSetting, isLoading } = useSettings(supabase);
  const [localSettings, setLocalSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  if (isLoading || !supabase) {
    return <div>Loading settings...</div>;
  }

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    for (const [key, value] of Object.entries(localSettings)) {
      if (value !== settings[key]) {
        await updateSetting(key, value);
      }
    }
    setHasChanges(false);
  };

  const settingsFields = [
    { key: 'openai_url', label: 'OpenAI URL', type: 'text' },
    { key: 'openai_api_key', label: 'OpenAI API Key', type: 'password' },
    { key: 'build', label: 'Build', type: 'text' },
    { key: 'version', label: 'Version', type: 'text' },
    { key: 'def_admin_prompt', label: 'Default Admin Prompt', type: 'textarea' },
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <form autoComplete="off">
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
        </div>
        <div className="mt-6">
          <Button
            variant="link"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
