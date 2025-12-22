import React from 'react';
import { PromptNamingSettings } from '../PromptNamingSettings';

export function PromptNamingSection({ settings, updateSetting }) {
  return (
    <PromptNamingSettings settings={settings} updateSetting={updateSetting} />
  );
}
