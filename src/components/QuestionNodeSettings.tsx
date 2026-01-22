import React from 'react';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingRow } from '@/components/ui/setting-row';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MessageCircleQuestion } from 'lucide-react';

/**
 * QuestionNodeSettings - Configuration panel for question prompt type
 * 
 * Manages settings like max questions, completion mode, and progress display.
 * Uses M3 design system patterns.
 */
export function QuestionNodeSettings({ config, onChange }) {
  const safeConfig = config || {
    max_questions: 10,
    completion_mode: 'ai_decides',
    show_progress: true
  };
  
  const handleChange = (key, value) => {
    onChange({ ...safeConfig, [key]: value });
  };
  
  return (
    <div className="space-y-4">
      <SettingCard label="QUESTION SETTINGS">
        <SettingRow
          label="Max Questions"
          description="Maximum number of questions AI can ask"
        >
          <Input
            type="number"
            value={safeConfig.max_questions || 10}
            onChange={(e) => handleChange('max_questions', parseInt(e.target.value) || 10)}
            min={1}
            max={50}
            className="w-20 h-8 text-body-sm"
          />
        </SettingRow>
        
        <div className="h-px bg-outline-variant" />
        
        <SettingRow
          label="Completion Mode"
          description="When to end the Q&A session"
        >
          <Select
            value={safeConfig.completion_mode || 'ai_decides'}
            onValueChange={(v) => handleChange('completion_mode', v)}
          >
            <SelectTrigger className="w-32 h-8 text-body-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai_decides">AI Decides</SelectItem>
              <SelectItem value="max_reached">At Max Questions</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        
        <div className="h-px bg-outline-variant" />
        
        <SettingRow
          label="Show Progress"
          description="Display question count in popup"
        >
          <Switch
            checked={safeConfig.show_progress !== false}
            onCheckedChange={(v) => handleChange('show_progress', v)}
          />
        </SettingRow>
      </SettingCard>
      
      {/* Info card */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 border border-outline-variant">
        <div className="flex items-start gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-body-sm text-on-surface">How Question Prompts Work</p>
            <p className="text-[10px] text-on-surface-variant">
              When this prompt runs, the AI can ask the user questions one at a time via a popup dialog. 
              Each answer is stored as a variable with the <code className="text-primary">ai_</code> prefix.
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              Variables created: <code className="text-primary">{`{{ai_variablename}}`}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuestionNodeSettings;
