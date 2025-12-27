import React, { useState, useEffect } from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getThemePreference, setThemePreference } from '@/components/ui/sonner';

const AppearanceSection = () => {
  const [theme, setTheme] = useState(getThemePreference());

  useEffect(() => {
    const handleChange = () => {
      setTheme(getThemePreference());
    };
    window.addEventListener('theme-preference-change', handleChange);
    return () => window.removeEventListener('theme-preference-change', handleChange);
  }, []);

  const handleThemeChange = (value) => {
    setThemePreference(value);
    setTheme(value);
  };

  return (
    <div className="space-y-4">
      <div className="p-5 border border-outline-variant rounded-2xl bg-surface-container-low space-y-4">
        <Label className="text-title-small font-medium text-on-surface">Theme</Label>
        <RadioGroup value={theme} onValueChange={handleThemeChange} className="space-y-3">
          <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-on-surface/4 transition-colors duration-short-4 ease-standard">
            <RadioGroupItem value="system" id="system" />
            <Label htmlFor="system" className="flex items-center gap-3 cursor-pointer flex-1">
              <div className="h-10 w-10 rounded-xl bg-surface-container-high flex items-center justify-center">
                <Monitor className="h-5 w-5 text-on-surface-variant" />
              </div>
              <div className="flex-1">
                <span className="text-body-large text-on-surface">System</span>
                <p className="text-label-medium text-on-surface-variant">Follow OS setting</p>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-on-surface/4 transition-colors duration-short-4 ease-standard">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="flex items-center gap-3 cursor-pointer flex-1">
              <div className="h-10 w-10 rounded-xl bg-surface-container-high flex items-center justify-center">
                <Sun className="h-5 w-5 text-on-surface-variant" />
              </div>
              <div className="flex-1">
                <span className="text-body-large text-on-surface">Light</span>
                <p className="text-label-medium text-on-surface-variant">Always light mode</p>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-on-surface/4 transition-colors duration-short-4 ease-standard">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="flex items-center gap-3 cursor-pointer flex-1">
              <div className="h-10 w-10 rounded-xl bg-surface-container-high flex items-center justify-center">
                <Moon className="h-5 w-5 text-on-surface-variant" />
              </div>
              <div className="flex-1">
                <span className="text-body-large text-on-surface">Dark</span>
                <p className="text-label-medium text-on-surface-variant">Always dark mode</p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default AppearanceSection;
