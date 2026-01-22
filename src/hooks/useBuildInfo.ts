import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'qonsol_build_info';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

interface CachedBuildInfo {
  build: string | null;
  tagName: string | null;
  releaseDate: string | null;
  releaseUrl: string | null;
}

interface CacheEntry {
  data: CachedBuildInfo;
  timestamp: number;
}

interface UseBuildInfoReturn {
  build: string | null;
  tagName: string | null;
  releaseDate: string | null;
  releaseUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch build information from the latest GitHub release.
 * Caches the result in localStorage with a 1-hour TTL.
 */
export const useBuildInfo = (): UseBuildInfoReturn => {
  const [build, setBuild] = useState<string | null>(null);
  const [tagName, setTagName] = useState<string | null>(null);
  const [releaseDate, setReleaseDate] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuildInfo = useCallback(async (skipCache = false) => {
    // Check cache first (unless skipping)
    if (!skipCache) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached) as CacheEntry;
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
        const cacheEntry: CacheEntry = {
          data: {
            build: extractedBuild,
            tagName: data.tag_name,
            releaseDate: formattedDate,
            releaseUrl: data.html_url
          },
          timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
      } catch (e) {
        console.warn('Failed to cache build info:', e);
      }

    } catch (err) {
      const errorMessage = (err as Error).message;
      // Downgrade to warn for expected conditions like no releases
      if (errorMessage === 'No releases found') {
        console.warn('No GitHub releases found yet');
      } else {
        console.error('Error fetching build info:', err);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuildInfo();
  }, [fetchBuildInfo]);

  const refetch = useCallback(() => fetchBuildInfo(true), [fetchBuildInfo]);

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
