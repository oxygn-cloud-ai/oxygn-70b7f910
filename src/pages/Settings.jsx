import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import SettingField from '../components/SettingField';

const Settings = () => {
  const supabase = useSupabase();
  const { settings, updateSetting, isLoading } = useSettings(supabase);

  if (isLoading || !supabase) {
    return <div>Loading settings...</div>;
  }

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
      <div className="space-y-4">
        {settingsFields.map(({ key, label, type }) => (
          <SettingField
            key={key}
            id={key}
            label={label}
            type={type}
            value={settings[key] || ''}
            onChange={(value) => updateSetting(key, value)}
          />
        ))}
      </div>
    </div>
  );
};

export default Settings;
