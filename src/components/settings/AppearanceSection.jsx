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
          <RadioGroup value={theme} onValueChange={handleThemeChange} className="space-y-3">
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span>System</span>
                <span className="text-xs text-muted-foreground">— Follow OS setting</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <span>Light</span>
                <span className="text-xs text-muted-foreground">— Always light mode</span>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span>Dark</span>
                <span className="text-xs text-muted-foreground">— Always dark mode</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppearanceSection;
