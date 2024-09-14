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
    try {
      let { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // If no settings exist, create a default row
        const defaultSettings = {
          openai_url: '',
          openai_api_key: ''
        };

        const { data: newData, error: insertError } = await supabase
          .from('settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) throw insertError;

        data = newData;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const { error } = await supabase
        .from('settings')
        .update({ [key]: value })
        .eq('id', settings.id);

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
