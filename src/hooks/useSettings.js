import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const useSettings = () => {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      console.log('Supabase API Call:', {
        table: 'settings',
        action: 'select',
        query: 'Select *',
      });

      const { data, error } = await supabase
        .from('settings')
        .select('*');

      console.log('Supabase API Response:', {
        data,
        error,
      });

      if (error) throw error;

      if (data.length === 0) {
        console.log('No settings found, creating default settings');
        const defaultSettings = {
          openai_url: 'https://api.openai.com/v1/chat/completions',
          openai_api_key: '',
          build: '',
          version: ''
        };

        console.log('Supabase API Call:', {
          table: 'settings',
          action: 'insert',
          data: defaultSettings,
        });

        const { data: insertedData, error: insertError } = await supabase
          .from('settings')
          .insert(defaultSettings)
          .select()
          .single();

        console.log('Supabase API Response:', {
          data: insertedData,
          error: insertError,
        });

        if (insertError) throw insertError;

        console.log('Default settings created:', insertedData);
        setSettings(insertedData);
      } else if (data.length > 1) {
        console.warn('Multiple settings found, using the first one');
        setSettings(data[0]);
      } else {
        setSettings(data[0]);
      }
    } catch (error) {
      console.error('Error fetching or creating settings:', error);
      toast.error('Failed to fetch or create settings');
      setSettings({ openai_url: '', openai_api_key: '', build: '', version: '' });
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

      console.log('Supabase API Call:', {
        table: 'settings',
        action: 'update',
        data: { [key]: value },
        query: `Update where openai_url = ${settings.openai_url}`,
      });

      const { data, error } = await supabase
        .from('settings')
        .update({ [key]: value })
        .match({ openai_url: settings.openai_url })
        .select();

      console.log('Supabase API Response:', {
        data,
        error,
      });

      if (error) throw error;

      if (data.length === 0) {
        throw new Error('No rows updated');
      }

      setSettings(prevSettings => ({ ...prevSettings, [key]: value }));
      toast.success('Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error(`Failed to update setting: ${error.message}`);
    }
  };

  return { settings, updateSetting, isLoading };
};
