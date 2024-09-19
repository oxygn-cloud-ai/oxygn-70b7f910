import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export const useSettings = (supabase) => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (supabase) {
      fetchSettings();
    }
  }, [supabase]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('*').single();

      if (error) throw error;

      if (!data) {
        console.log('No settings found, creating default settings');
        const defaultSettings = {
          openai_url: 'https://api.openai.com/v1/chat/completions',
          openai_api_key: '',
          build: '',
          version: '',
          def_admin_prompt: ''
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('settings')
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
      toast.error('Failed to fetch or create settings');
      setSettings({ openai_url: '', openai_api_key: '', build: '', version: '', def_admin_prompt: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      console.log(`Updating setting: ${key} = ${value}`);
      if (!settings) {
        throw new Error('Settings not initialized');
      }

      const { data, error } = await supabase
        .from('settings')
        .update({ [key]: value })
        .eq('id', settings.id)
        .select();

      if (error) throw error;

      if (data.length === 0) {
        throw new Error('No rows updated');
      }

      setSettings(prevSettings => ({ ...prevSettings, [key]: value }));
      console.log('Setting updated successfully:', key, value);
      toast.success('Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error(`Failed to update setting: ${error.message}`);
    }
  };

  return { settings, updateSetting, isLoading };
};
