import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from '../hooks/useSettings';

const Settings = () => {
  const { settings, updateSetting, isLoading } = useSettings();
  const [openaiUrl, setOpenaiUrl] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  useEffect(() => {
    if (settings) {
      setOpenaiUrl(settings.openai_url || '');
      setOpenaiApiKey(settings.openai_api_key || '');
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSetting('openai_url', openaiUrl);
    await updateSetting('openai_api_key', openaiApiKey);
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="space-y-4">
        <div>
          <Label htmlFor="openai-url">OpenAI URL</Label>
          <Input
            id="openai-url"
            value={openaiUrl}
            onChange={(e) => setOpenaiUrl(e.target.value)}
            placeholder="Enter OpenAI URL"
          />
        </div>
        <div>
          <Label htmlFor="openai-api-key">OpenAI API Key</Label>
          <Input
            id="openai-api-key"
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="Enter OpenAI API Key"
          />
        </div>
        <Button variant="link" onClick={handleSave} className="text-blue-500 hover:text-blue-700 p-0">
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;
