import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'qonsol_build_info';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Hook to fetch build information from the latest GitHub release.
 * Caches the result in localStorage with a 1-hour TTL.
 * 
 * @returns {{ build: string|null, tagName: string|null, releaseDate: string|null, releaseUrl: string|null, isLoading: boolean, error: string|null, refetch: () => void }}
 */
export const useBuildInfo = () => {
  const [build, setBuild] = useState(null);
  const [tagName, setTagName] = useState(null);
  const [releaseDate, setReleaseDate] = useState(null);
  const [releaseUrl, setReleaseUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBuildInfo = async (skipCache = false) => {
    // Check cache first (unless skipping)
    if (!skipCache) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < CACHE_TTL) {
            console.log('Using cached build info');
            setBuild(data.build);
            setTagName(data.tagName);
            setReleaseDate(data.releaseDate);
            setReleaseUrl(data.releaseUrl);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to read build info cache:', e);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching build info from GitHub...');
      
      const { data, error: fnError } = await supabase.functions.invoke('github-release');

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error && !data.tag_name) {
        throw new Error(data.error);
      }

      // Extract short SHA from tag name (e.g., "v-a1b2c3d" -> "a1b2c3d")
      const extractedBuild = data.tag_name 
        ? data.tag_name.replace(/^v-/, '') 
        : null;

      // Format release date
      const formattedDate = data.published_at 
        ? new Date(data.published_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : null;

      setBuild(extractedBuild);
      setTagName(data.tag_name);
      setReleaseDate(formattedDate);
      setReleaseUrl(data.html_url);

      // Cache the result
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: {
            build: extractedBuild,
            tagName: data.tag_name,
            releaseDate: formattedDate,
            releaseUrl: data.html_url
          },
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to cache build info:', e);
      }

    } catch (err) {
      console.error('Error fetching build info:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildInfo();
  }, []);

  const refetch = () => fetchBuildInfo(true);

  return {
    build,
    tagName,
    releaseDate,
    releaseUrl,
    isLoading,
    error,
    refetch
  };
};
