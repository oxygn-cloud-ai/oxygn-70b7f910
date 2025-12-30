import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

export const useSettings = (supabase) => {
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    if (!supabase) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('*');

      if (fetchError) throw fetchError;

      // Convert array of key-value pairs to an object
      const settingsObj = {};
      if (data && data.length > 0) {
        data.forEach(row => {
          settingsObj[row.setting_key] = {
            value: row.setting_value || '',
            description: row.setting_description || '',
            row_id: row.row_id
          };
        });
      }
      
      setSettings(settingsObj);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err);
      toast.error('Failed to fetch settings', {
        source: 'useSettings.fetchSettings',
        errorCode: err?.code || 'SETTINGS_FETCH_ERROR',
        details: JSON.stringify({ error: err?.message, stack: err?.stack }, null, 2),
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key, value) => {
    if (!supabase) return;
    
    try {
      const existingSetting = settings[key];
      
      if (existingSetting?.row_id) {
        // Update existing setting
        const { error } = await supabase
          .from(import.meta.env.VITE_SETTINGS_TBL)
          .update({ setting_value: value })
          .eq('row_id', existingSetting.row_id);

        if (error) throw error;
        
        setSettings(prev => ({
          ...prev,
          [key]: { ...prev[key], value }
        }));
      } else {
        // Insert new setting and capture the row_id
        const { data, error } = await supabase
          .from(import.meta.env.VITE_SETTINGS_TBL)
          .insert({ setting_key: key, setting_value: value })
          .select()
          .single();

        if (error) throw error;
        
        setSettings(prev => ({
          ...prev,
          [key]: { value, description: '', row_id: data.row_id }
        }));
      }
      
      // Track setting update
      trackEvent('setting_updated', {
        setting_key: key,
      });
    } catch (err) {
      console.error('Error updating setting:', err);
      throw err;
    }
  };

  const addSetting = async (key, value, description = '') => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .insert({ setting_key: key, setting_value: value, setting_description: description })
        .select()
        .single();

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        [key]: { value, description, row_id: data.row_id }
      }));
      
      return data;
    } catch (err) {
      console.error('Error adding setting:', err);
      throw err;
    }
  };

  const deleteSetting = async (key) => {
    if (!supabase || !settings[key]?.row_id) return;
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .delete()
        .eq('row_id', settings[key].row_id);

      if (error) throw error;

      setSettings(prev => {
        const newSettings = { ...prev };
        delete newSettings[key];
        return newSettings;
      });
    } catch (err) {
      console.error('Error deleting setting:', err);
      throw err;
    }
  };

  return { 
    settings, 
    updateSetting, 
    addSetting, 
    deleteSetting, 
    isLoading, 
    error,
    refetch: fetchSettings 
  };
};
