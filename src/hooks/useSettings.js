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
      console.log('Fetching settings...');
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error) throw error;

      if (!data) {
        console.log('No settings found, creating default settings');
        const defaultSettings = {
          openai_url: 'https://api.openai.com/v1/chat/completions',
          openai_api_key: ''
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
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching or creating settings:', error);
      toast.error('Failed to fetch or create settings');
      setSettings({ openai_url: '', openai_api_key: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      console.log(`Updating setting: ${key} = ${value}`);
      const { data, error } = await supabase
        .from('settings')
        .update({ [key]: value })
        .select()
        .single();

      if (error) throw error;

      setSettings(prevSettings => ({ ...prevSettings, [key]: value }));
      toast.success('Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error(`Failed to update setting: ${error.message}`);
    }
  };

  const getLatestSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching latest settings:', error);
      toast.error('Failed to fetch latest settings');
      return null;
    }
  };

  return { settings, updateSetting, isLoading, getLatestSettings };
};
