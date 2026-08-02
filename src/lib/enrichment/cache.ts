/**
 * CTRForge Enrichment Pipeline — Provider-Level Cache
 * 
 * In-memory cache with configurable TTL per provider.
 * Prevents duplicate API calls when the same creator is
 * enriched multiple times during a session (e.g. pagination).
 * 
 * Each provider gets its own isolated cache namespace.
 */

interface CacheEntry {
  timestamp: number;
  data: any;
}

// Map of provider name → Map of cache key → entry
const caches = new Map<string, Map<string, CacheEntry>>();

/**
 * Get a cached result for a provider + key combination.
 * Returns null if no cache entry exists or if it has expired.
 * 
 * @param provider - Provider name (cache namespace)
 * @param key - Cache key (typically channelId)
 * @param ttlMs - Time-to-live in milliseconds
 */
export function getCached(provider: string, key: string, ttlMs: number): any | null {
  const providerCache = caches.get(provider);
  if (!providerCache) return null;

  const entry = providerCache.get(key);
  if (!entry) return null;

  // Check expiration
  if (Date.now() - entry.timestamp > ttlMs) {
    providerCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store a result in the provider cache.
 * 
 * @param provider - Provider name (cache namespace)
 * @param key - Cache key (typically channelId)
 * @param data - Data to cache
 */
export function setCache(provider: string, key: string, data: any): void {
  if (!caches.has(provider)) {
    caches.set(provider, new Map());
  }
  caches.get(provider)!.set(key, { timestamp: Date.now(), data });
}

/**
 * Invalidate a specific cache entry.
 * Used for refresh-on-demand when a user forces re-enrichment.
 * 
 * @param provider - Provider name (cache namespace)
 * @param key - Cache key to invalidate
 */
export function invalidateCache(provider: string, key: string): void {
  caches.get(provider)?.delete(key);
}

/**
 * Invalidate all cache entries for a specific channel across all providers.
 * Used when forcing a full re-enrichment of a creator.
 * 
 * @param key - Cache key to invalidate across all providers
 */
export function invalidateAllCachesForKey(key: string): void {
  Array.from(caches.values()).forEach(providerCache => {
    providerCache.delete(key);
  });
}

/**
 * Clear the entire cache for a specific provider.
 * 
 * @param provider - Provider name to clear
 */
export function clearProviderCache(provider: string): void {
  caches.get(provider)?.clear();
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  caches.forEach((cache, provider) => {
    stats[provider] = cache.size;
  });
  return stats;
}
