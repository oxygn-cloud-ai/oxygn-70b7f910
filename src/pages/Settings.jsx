import React, { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';
import SettingField from '../components/SettingField';
import { Button } from "@/components/ui/button";
import { InfoIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    { 
      key: 'openai_url', 
      label: 'OpenAI URL', 
      type: 'text',
      info: 'The URL for OpenAI API requests. Default is https://api.openai.com/v1/chat/completions'
    },
    { 
      key: 'openai_api_key', 
      label: 'OpenAI API Key', 
      type: 'password',
      info: 'Your OpenAI API key. Keep this secret and secure.'
    },
    { 
      key: 'build', 
      label: 'Build', 
      type: 'text',
      info: 'The current build number of the application.'
    },
    { 
      key: 'version', 
      label: 'Version', 
      type: 'text',
      info: 'The current version of the application.'
    },
    { 
      key: 'def_admin_prompt', 
      label: 'Default Admin Prompt', 
      type: 'textarea',
      info: 'The default admin prompt used when creating new items.'
    },
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <form autoComplete="off">
        <div className="space-y-4">
          {settingsFields.map(({ key, label, type, info }) => (
            <div key={key} className="flex items-center">
              <SettingField
                id={key}
                label={label}
                type={type}
                value={localSettings[key] || ''}
                onChange={(value) => handleChange(key, value)}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 ml-2 text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{info}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
