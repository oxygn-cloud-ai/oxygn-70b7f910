import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from '../hooks/useSettings';

const Settings = () => {
  const { settings, updateSetting, isLoading } = useSettings();
  const [openaiUrl, setOpenaiUrl] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [build, setBuild] = useState('');
  const [version, setVersion] = useState('');
  const [urlChanged, setUrlChanged] = useState(false);
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [buildChanged, setBuildChanged] = useState(false);
  const [versionChanged, setVersionChanged] = useState(false);

  useEffect(() => {
    if (settings) {
      setOpenaiUrl(settings.openai_url || '');
      setOpenaiApiKey(settings.openai_api_key || '');
      setBuild(settings.build || '');
      setVersion(settings.version || '');
      setUrlChanged(false);
      setApiKeyChanged(false);
      setBuildChanged(false);
      setVersionChanged(false);
    }
  }, [settings]);

  const handleSave = async () => {
    if (urlChanged) {
      await updateSetting('openai_url', openaiUrl);
    }
    if (apiKeyChanged) {
      await updateSetting('openai_api_key', openaiApiKey);
    }
    if (buildChanged) {
      await updateSetting('build', build);
    }
    if (versionChanged) {
      await updateSetting('version', version);
    }
    setUrlChanged(false);
    setApiKeyChanged(false);
    setBuildChanged(false);
    setVersionChanged(false);
  };

  const handleUrlChange = (e) => {
    setOpenaiUrl(e.target.value);
    setUrlChanged(true);
  };

  const handleApiKeyChange = (e) => {
    setOpenaiApiKey(e.target.value);
    setApiKeyChanged(true);
  };

  const handleBuildChange = (e) => {
    setBuild(e.target.value);
    setBuildChanged(true);
  };

  const handleVersionChange = (e) => {
    setVersion(e.target.value);
    setVersionChanged(true);
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
          <Label htmlFor="build">Build</Label>
          <Input
            id="build"
            value={build}
            onChange={handleBuildChange}
            placeholder="Enter Build"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            value={version}
            onChange={handleVersionChange}
            placeholder="Enter Version"
            autoComplete="off"
          />
        </div>
        <Button 
          variant="link"
          onClick={handleSave} 
          disabled={!urlChanged && !apiKeyChanged && !buildChanged && !versionChanged}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;
