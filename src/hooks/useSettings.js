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
      const query = supabase.from('settings').select('*');

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'GET',
        headers: query.headers,
        body: null,
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
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

        const insertQuery = supabase.from('settings').insert(defaultSettings).select().single();

        console.log('Supabase API Call:', {
          url: insertQuery.url.toString(),
          method: 'POST',
          headers: insertQuery.headers,
          body: JSON.stringify(defaultSettings),
        });

        const { data: insertedData, error: insertError } = await insertQuery;

        console.log('Supabase API Response:', {
          status: insertedData ? 200 : 500,
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

      const query = supabase
        .from('settings')
        .update({ [key]: value })
        .match({ openai_url: settings.openai_url })
        .select();

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'PATCH',
        headers: query.headers,
        body: JSON.stringify({ [key]: value }),
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
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
