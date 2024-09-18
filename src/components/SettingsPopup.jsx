import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, RotateCcw } from 'lucide-react';

const SettingsPopup = ({ localSettings, handleSettingChange, handleSettingSave, handleSettingReset }) => {
  const renderSettingFields = () => {
    const fields = [
      { key: 'openai_url', label: 'OpenAI URL', type: 'text' },
      { key: 'openai_api_key', label: 'OpenAI API Key', type: 'password' },
      { key: 'build', label: 'Build', type: 'text' },
      { key: 'version', label: 'Version', type: 'text' },
      { key: 'def_admin_prompt', label: 'Default Admin Prompt', type: 'textarea' },
    ];

    return fields.map(({ key, label, type }) => (
      <div key={key} className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label htmlFor={key} className="text-sm font-medium">{label}</label>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSettingSave(key)}
              className="h-6 w-6"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSettingReset(key)}
              className="h-6 w-6"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {type === 'textarea' ? (
          <Textarea
            id={key}
            value={localSettings[key] || ''}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            className="w-full mt-1"
          />
        ) : (
          <Input
            id={key}
            type={type}
            value={localSettings[key] || ''}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            className="w-full mt-1"
          />
        )}
      </div>
    ));
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="reuse-prompts">
        <AccordionTrigger>Reuse Prompts</AccordionTrigger>
        <AccordionContent>
          {renderSettingFields()}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default SettingsPopup;
