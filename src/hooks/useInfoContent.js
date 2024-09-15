import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const useInfoContent = () => {
  const [infoContent, setInfoContent] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInfoContent();
  }, []);

  const fetchInfoContent = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('info')
        .select('info_key, content');

      if (error) throw error;

      const contentMap = data.reduce((acc, item) => {
        acc[item.info_key] = item.content;
        return acc;
      }, {});

      setInfoContent(contentMap);
    } catch (error) {
      console.error('Error fetching info content:', error);
      toast.error(`Failed to fetch info content: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return { infoContent, isLoading };
};