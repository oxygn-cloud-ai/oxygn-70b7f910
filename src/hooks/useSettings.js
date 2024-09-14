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
      let { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle();

      if (error && error.code === 'PGRST116') {
        // No settings found, create default settings
        const defaultSettings = {
          openai_url: '',
          openai_api_key: ''
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('settings')
          .insert(defaultSettings)
          .single();

        if (insertError) throw insertError;

        data = insertedData;
      } else if (error) {
        throw error;
      }

      setSettings(data || { openai_url: '', openai_api_key: '' });
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
      const { data, error } = await supabase
        .from('settings')
        .update({ [key]: value })
        .eq('id', settings.id)
        .single();

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  return { settings, updateSetting, isLoading };
};
