import React, { useState, useEffect } from 'react';
import { Palette, Monitor, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
          <p className="text-sm text-muted-foreground">Customize the look and feel of the application</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription>Select your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={handleThemeChange} className="grid grid-cols-3 gap-4">
            <Label
              htmlFor="system"
              className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent ${
                theme === 'system' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <RadioGroupItem value="system" id="system" className="sr-only" />
              <Monitor className="h-6 w-6 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">System</span>
              <span className="text-xs text-muted-foreground">Follow OS setting</span>
            </Label>
            <Label
              htmlFor="light"
              className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent ${
                theme === 'light' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <RadioGroupItem value="light" id="light" className="sr-only" />
              <Sun className="h-6 w-6 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Light</span>
              <span className="text-xs text-muted-foreground">Always light mode</span>
            </Label>
            <Label
              htmlFor="dark"
              className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all hover:bg-accent ${
                theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <RadioGroupItem value="dark" id="dark" className="sr-only" />
              <Moon className="h-6 w-6 mb-2 text-muted-foreground" />
              <span className="text-sm font-medium">Dark</span>
              <span className="text-xs text-muted-foreground">Always dark mode</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppearanceSection;
