import React from 'react';
import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useUIPreference } from '@/contexts/UIPreferenceContext';

const NewUISection = () => {
  const { isNewUI, toggleUI } = useUIPreference();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">New UI (Beta)</h2>
          <p className="text-sm text-muted-foreground">
            Try out the experimental new interface
          </p>
        </div>
      </div>

      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium text-foreground">Enable New UI</p>
            <p className="text-sm text-muted-foreground">
              Switch to the new Material 3-inspired interface. You can switch back anytime from the hamburger menu.
            </p>
          </div>
          <Switch
            checked={isNewUI}
            onCheckedChange={toggleUI}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>
          The new UI is still in development. Some features may not be fully functional yet.
        </p>
      </div>
    </div>
  );
};

export default NewUISection;
