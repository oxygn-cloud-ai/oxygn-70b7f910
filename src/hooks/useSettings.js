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

      if (data) {
        setSettings(data);
      } else {
        // If no settings exist, set default values
        setSettings({
          openai_url: '',
          openai_api_key: ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      if (!settings || !settings.id) {
        // If settings don't exist, create a new row
        const { data, error } = await supabase
          .from('settings')
          .insert({ [key]: value })
          .select()
          .single();

        if (error) throw error;

        setSettings(data);
      } else {
        // If settings exist, update the existing row
        const { error } = await supabase
          .from('settings')
          .update({ [key]: value })
          .eq('id', settings.id);

        if (error) throw error;

        setSettings(prev => ({ ...prev, [key]: value }));
      }

      toast.success('Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  return { settings, updateSetting, isLoading };
};
