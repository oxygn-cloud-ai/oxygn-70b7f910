import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Pattern to match q.ref[UUID].field syntax
const UUID_PATTERN = /\{\{q\.ref\[([a-f0-9-]{36})\]\.([a-z_]+)\}\}/gi;

/**
 * Extract all UUIDs from text that match the q.ref[UUID].field pattern
 */
export const extractRefUuids = (text) => {
  if (!text) return [];
  
  const uuids = new Set();
  let match;
  
  // Reset regex lastIndex
  UUID_PATTERN.lastIndex = 0;
  
  while ((match = UUID_PATTERN.exec(text)) !== null) {
    uuids.add(match[1].toLowerCase());
  }
  
  return Array.from(uuids);
};

/**
 * Extract all q.ref references with their field names
 * Returns array of { uuid, field } objects
 */
export const extractRefDetails = (text) => {
  if (!text) return [];
  
  const refs = [];
  let match;
  
  // Reset regex lastIndex
  UUID_PATTERN.lastIndex = 0;
  
  while ((match = UUID_PATTERN.exec(text)) !== null) {
    refs.push({
      uuid: match[1].toLowerCase(),
      field: match[2],
      fullMatch: match[0],
    });
  }
  
  return refs;
};

// Simple in-memory cache for prompt names
const nameCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Hook to batch-fetch prompt names for UUIDs found in text
 * Returns a Map of UUID -> { name, row_id }
 */
export const usePromptNameLookup = (textContent) => {
  const [nameMap, setNameMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Extract UUIDs from text content
  const uuids = useMemo(() => {
    return extractRefUuids(textContent);
  }, [textContent]);

  // Fetch prompt names for UUIDs
  useEffect(() => {
    const fetchNames = async () => {
      if (uuids.length === 0) {
        setNameMap(new Map());
        return;
      }

      // Check cache first
      const now = Date.now();
      const uncachedUuids = [];
      const cachedResults = new Map();

      uuids.forEach(uuid => {
        const cached = nameCache.get(uuid);
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          cachedResults.set(uuid, cached.data);
        } else {
          uncachedUuids.push(uuid);
        }
      });

      // If all cached, use cache
      if (uncachedUuids.length === 0) {
        setNameMap(cachedResults);
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('q_prompts')
          .select('row_id, prompt_name')
          .in('row_id', uncachedUuids);

        if (error) {
          console.error('Error fetching prompt names:', error);
          setNameMap(cachedResults);
          return;
        }

        // Build result map and update cache
        const resultMap = new Map(cachedResults);
        
        (data || []).forEach(prompt => {
          const entry = {
            name: prompt.prompt_name || 'Untitled',
            row_id: prompt.row_id,
          };
          resultMap.set(prompt.row_id, entry);
          
          // Update cache
          nameCache.set(prompt.row_id, {
            data: entry,
            timestamp: now,
          });
        });

        // Mark missing UUIDs
        uncachedUuids.forEach(uuid => {
          if (!resultMap.has(uuid)) {
            resultMap.set(uuid, { name: 'Unknown', row_id: uuid });
          }
        });

        setNameMap(resultMap);
      } catch (err) {
        console.error('Error in usePromptNameLookup:', err);
        setNameMap(cachedResults);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNames();
  }, [uuids]);

  return { nameMap, isLoading, uuids };
};

/**
 * Fetch prompt names for a list of UUIDs (non-hook version for use in callbacks)
 */
export const fetchPromptNames = async (uuids) => {
  if (!uuids || uuids.length === 0) return new Map();

  try {
    const { data, error } = await supabase
      .from('q_prompts')
      .select('row_id, prompt_name')
      .in('row_id', uuids);

    if (error) {
      console.error('Error fetching prompt names:', error);
      return new Map();
    }

    const resultMap = new Map();
    (data || []).forEach(prompt => {
      resultMap.set(prompt.row_id, {
        name: prompt.prompt_name || 'Untitled',
        row_id: prompt.row_id,
      });
    });

    return resultMap;
  } catch (err) {
    console.error('Error in fetchPromptNames:', err);
    return new Map();
  }
};

/**
 * Clear the name cache (useful for testing or after bulk updates)
 */
export const clearNameCache = () => {
  nameCache.clear();
};

export default usePromptNameLookup;
