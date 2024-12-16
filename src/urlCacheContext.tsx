import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';


// Define our types
interface CachedUrl {
  url: string;
  expiresAt: number; // timestamp in milliseconds
}

interface UrlCache {
  [key: string]: CachedUrl;
}

interface UrlCacheContextType {
  getStorageUrl: (path: string) => Promise<string>;
  clearCache: () => void;  // Added type definition
}

// Hard-code testMode here
const testMode = true;  // Change to false when you don't want test mode

// Create the context
const UrlCacheContext = createContext<UrlCacheContextType | undefined>(undefined);

// Local storage key
const CACHE_STORAGE_KEY = 'urlCache';

// URL expiration time (7 days in seconds)
const URL_EXPIRATION = 3420;  // 7 days - 604800, 3420 seems like its amazons default and wont override.
const MINIMUM_REMAINING_TIME = 3000; // 2 hours (7200) - minimum time before we refresh, lowering for testing


export function UrlCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<UrlCache>(() => {
    // Initialize cache from localStorage
    try {
      const stored = localStorage.getItem(CACHE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading cache from localStorage:', error);
      return {};
    }
  });

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving cache to localStorage:', error);
    }
  }, [cache]);

  // Clean expired entries whenever cache is loaded or updated
  useEffect(() => {
    const now = Date.now();
    const newCache = { ...cache };
    let hasChanges = false;

    Object.entries(cache).forEach(([path, entry]) => {
      if (entry.expiresAt < now) {
        delete newCache[path];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setCache(newCache);
    }
  }, [cache]);

  const getStorageUrl = async (path: string): Promise<string> => {

    if (testMode) {
      return '/picsoritdidnthappen.webp';
    }
    if (!path) {
      return '/picsoritdidnthappen.webp'; // Default image
    }

    const now = Date.now();

    // Check if we have a cached URL
    if (cache[path]) {
      const timeUntilExpiration = cache[path].expiresAt - now;
      
      // If URL is still valid and not approaching expiration
      if (timeUntilExpiration > MINIMUM_REMAINING_TIME * 1000) {
        return cache[path].url;
      }
      // If URL is approaching expiration or expired, we'll get a new one
    }

    try {
      // Get new URL from S3
      const linkToStorageFile = await getUrl({
        path,
        options: {
          expiresIn: URL_EXPIRATION
        }
      });

      const url = linkToStorageFile.url.toString();
      
      // Update cache with new URL
      setCache(prevCache => ({
        ...prevCache,
        [path]: {
          url,
          expiresAt: now + (URL_EXPIRATION * 1000)
        }
      }));

      return url;
    } catch (error) {
      console.error('Error getting storage URL:', error);
      return '/picsoritdidnthappen.webp'; // Fallback image
    }
  };

  const clearCache = () => {
    setCache({});
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing cache from localStorage:', error);
    }
  };

  const value = {
    getStorageUrl,
    clearCache
  };

  return (
    <UrlCacheContext.Provider value={value}>
      {children}
    </UrlCacheContext.Provider>
  );
}

// Custom hook to use the cache
export function useUrlCache() {
  const context = useContext(UrlCacheContext);
  if (context === undefined) {
    throw new Error('useUrlCache must be used within a UrlCacheProvider');
  }
  return context;
}