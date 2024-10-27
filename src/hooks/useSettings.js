import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useSettings = (supabase) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (supabase) {
      fetchSettings();
    }
  }, [supabase]);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settingsTable = import.meta.env.VITE_SETTINGS_TBL;
      
      if (!settingsTable) {
        throw new Error('Settings table environment variable is not defined');
      }

      const { data, error: fetchError } = await supabase
        .from(settingsTable)
        .select('*')
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        console.log('No settings found, creating default settings');
        const defaultSettings = {
          build: '',
          version: '',
          def_admin_prompt: ''
        };

        const { data: insertedData, error: insertError } = await supabase
          .from(settingsTable)
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) throw insertError;

        console.log('Default settings created:', insertedData);
        setSettings(insertedData);
      } else {
        console.log('Settings loaded:', data);
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching or creating settings:', error);
      setError(error);
      toast.error('Failed to fetch settings');
      setSettings({ build: '', version: '', def_admin_prompt: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      if (!settings) {
        throw new Error('Settings not initialized');
      }

      const settingsTable = import.meta.env.VITE_SETTINGS_TBL;
      
      if (!settingsTable) {
        throw new Error('Settings table environment variable is not defined');
      }

      const { data, error } = await supabase
        .from(settingsTable)
        .update({ [key]: value })
        .eq('setting_id', settings.setting_id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No rows updated');
      }

      setSettings(prevSettings => ({ ...prevSettings, [key]: value }));
      console.log('Setting updated successfully:', key, value);
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  };

  return { settings, updateSetting, isLoading, error };
};