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
      console.log('API Call Details:');
      console.log('URL:', `${supabase.supabaseUrl}/rest/v1/settings?select=*`);
      console.log('Method: GET');
      console.log('Headers:', {
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${supabase.supabaseKey}`,
      });

      const startTime = performance.now();
      let { data, error, status, statusText } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle();
      const endTime = performance.now();

      console.log('API Response:');
      console.log('Status:', status);
      console.log('Status Text:', statusText);
      console.log('Response Time:', `${(endTime - startTime).toFixed(2)}ms`);
      console.log('Response Data:', data);
      console.log('Error:', error);

      if (error && error.code === 'PGRST116') {
        console.log('No settings found, creating default settings');
        const defaultSettings = {
          openai_url: '',
          openai_api_key: ''
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('settings')
          .insert(defaultSettings)
          .single();

        if (insertError) throw insertError;

        console.log('Default settings created:', insertedData);
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
