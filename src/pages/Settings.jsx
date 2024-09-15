import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from '../hooks/useSettings';

const Settings = () => {
  const { settings, updateSetting, isLoading } = useSettings();
  const [openaiUrl, setOpenaiUrl] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [urlChanged, setUrlChanged] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [proxyUrlChanged, setProxyUrlChanged] = useState(false);

  useEffect(() => {
    if (settings) {
      setOpenaiUrl(settings.openai_url || '');
      setOpenaiApiKey(settings.openai_api_key || '');
      setProxyUrl(settings.proxy_url || '');
      setUrlChanged(false);
      setApiKeyChanged(false);
      setProxyUrlChanged(false);
    }
  }, [settings]);

  const handleSave = async () => {
    if (urlChanged) {
      await updateSetting('openai_url', openaiUrl);
    }
    if (apiKeyChanged) {
      await updateSetting('openai_api_key', openaiApiKey);
    }
    if (proxyUrlChanged) {
      await updateSetting('proxy_url', proxyUrl);
    }
    setUrlChanged(false);
    setApiKeyChanged(false);
    setProxyUrlChanged(false);
  };

  const handleUrlChange = (e) => {
    setOpenaiUrl(e.target.value);
    setUrlChanged(true);
  };

  const handleApiKeyChange = (e) => {
    setOpenaiApiKey(e.target.value);
    setApiKeyChanged(true);
  };

  const handleProxyUrlChange = (e) => {
    setProxyUrl(e.target.value);
    setProxyUrlChanged(true);
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
            onChange={handleUrlChange}
            placeholder="Enter OpenAI URL"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="openai-api-key">OpenAI API Key</Label>
          <Input
            id="openai-api-key"
            type="password"
            value={openaiApiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter OpenAI API Key"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="proxy-url">Proxy URL</Label>
          <Input
            id="proxy-url"
            value={proxyUrl}
            onChange={handleProxyUrlChange}
            placeholder="Enter Proxy URL"
            autoComplete="off"
          />
        </div>
        <Button 
          variant="link"
          onClick={handleSave} 
          disabled={!urlChanged && !apiKeyChanged && !proxyUrlChanged}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;
