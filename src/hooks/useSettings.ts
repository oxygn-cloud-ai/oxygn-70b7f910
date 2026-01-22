import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export interface SettingValue {
  value: string;
  description: string;
  row_id: string;
}

export type SettingsMap = Record<string, SettingValue>;

interface SettingRow {
  row_id: string;
  setting_key: string;
  setting_value: string | null;
  setting_description: string | null;
}

interface UseSettingsReturn {
  settings: SettingsMap;
  updateSetting: (key: string, value: string) => Promise<void>;
  addSetting: (key: string, value: string, description?: string) => Promise<SettingRow | undefined>;
  deleteSetting: (key: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useSettings = (
  supabase: SupabaseClient<Database> | null
): UseSettingsReturn => {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('*');

      if (fetchError) throw fetchError;

      // Convert array of key-value pairs to an object
      const settingsObj: SettingsMap = {};
      if (data && data.length > 0) {
        (data as SettingRow[]).forEach(row => {
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
      setError(err as Error);
      toast.error('Failed to fetch settings', {
        source: 'useSettings.fetchSettings',
        errorCode: (err as { code?: string })?.code || 'SETTINGS_FETCH_ERROR',
        details: JSON.stringify({ 
          error: (err as Error)?.message, 
          stack: (err as Error)?.stack 
        }, null, 2),
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: string): Promise<void> => {
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
          .maybeSingle();

        if (error) throw error;
        
        // Guard against null data (e.g., RLS rejection without error)
        if (!data) {
          throw new Error('Failed to create setting - no data returned');
        }
        
        setSettings(prev => ({
          ...prev,
          [key]: { value, description: '', row_id: (data as SettingRow).row_id }
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

  const addSetting = async (
    key: string, 
    value: string, 
    description = ''
  ): Promise<SettingRow | undefined> => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .insert({ setting_key: key, setting_value: value, setting_description: description })
        .select()
        .maybeSingle();

      if (error) throw error;
      
      // Guard against null data (e.g., RLS rejection without error)
      if (!data) {
        throw new Error('Failed to add setting - no data returned');
      }

      const settingRow = data as SettingRow;
      setSettings(prev => ({
        ...prev,
        [key]: { value, description, row_id: settingRow.row_id }
      }));
      
      return settingRow;
    } catch (err) {
      console.error('Error adding setting:', err);
      throw err;
    }
  };

  const deleteSetting = async (key: string): Promise<void> => {
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
