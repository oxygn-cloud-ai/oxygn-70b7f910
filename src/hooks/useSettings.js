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
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found, set default values
          setSettings({
            openai_url: '',
            openai_api_key: ''
          });
        } else {
          throw error;
        }
      } else {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
      // Set default values in case of error
      setSettings({
        openai_url: '',
        openai_api_key: ''
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      let result;
      if (settings && settings.id) {
        // Update existing settings
        result = await supabase
          .from('settings')
          .update({ [key]: value })
          .eq('id', settings.id)
          .single();
      } else {
        // Insert new settings
        result = await supabase
          .from('settings')
          .insert({ [key]: value })
          .single();
      }

      if (result.error) throw result.error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  return { settings, updateSetting, isLoading };
};
