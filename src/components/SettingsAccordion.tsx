import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LocalSettings {
  [key: string]: string;
}

interface SettingsAccordionProps {
  expandedSettings: string[];
  setExpandedSettings: (value: string[]) => void;
  localSettings: LocalSettings;
  handleSettingChange: (key: string, value: string) => void;
  handleSettingSave: (key: string, value: string) => void;
  handleSettingReset: (key: string) => void;
}

const SettingsAccordion: React.FC<SettingsAccordionProps> = ({
  expandedSettings,
  setExpandedSettings,
  localSettings,
  handleSettingChange,
  handleSettingSave,
  handleSettingReset
}) => {
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSettingSave(key, localSettings[key])}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSettingReset(key)}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
            autoComplete={type === 'password' ? 'new-password' : 'off'}
          />
        )}
      </div>
    ));
  };

  return (
    <Accordion
      type="multiple"
      value={expandedSettings}
      onValueChange={setExpandedSettings}
      className="w-full mt-4"
    >
      <AccordionItem value="settings">
        <AccordionTrigger>Settings</AccordionTrigger>
        <AccordionContent>
          {renderSettingFields()}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default SettingsAccordion;
