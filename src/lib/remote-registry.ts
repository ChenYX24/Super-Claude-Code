/** Remote community template registry with in-memory caching */

export interface RemoteTemplate {
  name: string;
  description: string;
  category: string;
  author: string;
  stars: number;
  content: string;
}

export interface RemoteRegistry {
  version: number;
  updated: string;
  skills: RemoteTemplate[];
  agents: RemoteTemplate[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Default registry URL - serves from the app's own public directory for testing */
const DEFAULT_REGISTRY_URL = "/registry/community-templates.json";

interface CacheEntry {
  data: RemoteRegistry;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

/**
 * Fetch community templates from a remote registry.
 * Returns cached data if available and not expired.
 * Returns null on network failure (offline-safe).
 */
export async function fetchRemoteRegistry(
  registryUrl: string = DEFAULT_REGISTRY_URL,
): Promise<RemoteRegistry | null> {
  if (isCacheValid()) {
    return cache!.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(registryUrl, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return cache?.data ?? null;
    }

    const data: RemoteRegistry = await res.json();

    // Basic validation
    if (!data || !Array.isArray(data.skills) || !Array.isArray(data.agents)) {
      return cache?.data ?? null;
    }

    cache = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    // Offline or network error - return stale cache if available
    return cache?.data ?? null;
  }
}

/** Force invalidate the cache */
export function invalidateRegistryCache(): void {
  cache = null;
}
