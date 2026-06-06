interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Helper to run Redis command
async function runRedisCommand(command: any[]): Promise<any> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    const result = await response.json();
    return result.result;
  } catch (error) {
    console.error('Failed to run Vercel KV command in cache:', error);
    return null;
  }
}

// Sanitize keys for Firebase RTDB
function sanitizeKey(key: string): string {
  return key
    .replace(/https?:\/\//gi, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .toLowerCase();
}

/**
 * Retrieves a value from the cache (Firebase, Vercel KV, or memory).
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  const hasFirebase = !!process.env.FIREBASE_DATABASE_URL;
  const hasKV = !hasFirebase && !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (hasFirebase) {
    try {
      let dbUrl = process.env.FIREBASE_DATABASE_URL || '';
      if (!dbUrl.endsWith('/')) dbUrl += '/';
      const secret = process.env.FIREBASE_DATABASE_SECRET || '';
      const authQuery = secret ? `?auth=${secret}` : '';

      const sanitized = sanitizeKey(key);
      const res = await fetch(`${dbUrl}nibokuu/cache/${sanitized}.json${authQuery}`);
      const entry = await res.json() as CacheEntry<T> | null;

      if (!entry) return null;

      if (Date.now() > entry.expiry) {
        // Expired, delete in background
        fetch(`${dbUrl}nibokuu/cache/${sanitized}.json${authQuery}`, {
          method: 'DELETE'
        }).catch(err => console.error('Failed to delete expired Firebase cache:', err));
        return null;
      }

      return entry.data;
    } catch (err) {
      console.error('Firebase getFromCache failed:', err);
      return null;
    }
  } else if (hasKV) {
    try {
      const raw = await runRedisCommand(['GET', `nibokuu:cache:${key}`]);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error('Vercel KV getFromCache failed:', err);
      return null;
    }
  }

  // Memory cache fallback
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Stores a value in the cache (Firebase, Vercel KV, or memory).
 * @param key The cache key
 * @param data The payload to store
 * @param ttlSeconds Expiry time in seconds (default: 600 seconds / 10 minutes)
 */
export async function setToCache<T>(key: string, data: T, ttlSeconds: number = 600): Promise<void> {
  const hasFirebase = !!process.env.FIREBASE_DATABASE_URL;
  const hasKV = !hasFirebase && !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (hasFirebase) {
    try {
      let dbUrl = process.env.FIREBASE_DATABASE_URL || '';
      if (!dbUrl.endsWith('/')) dbUrl += '/';
      const secret = process.env.FIREBASE_DATABASE_SECRET || '';
      const authQuery = secret ? `?auth=${secret}` : '';

      const sanitized = sanitizeKey(key);
      const entry: CacheEntry<T> = {
        data,
        expiry: Date.now() + ttlSeconds * 1000
      };

      await fetch(`${dbUrl}nibokuu/cache/${sanitized}.json${authQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (err) {
      console.error('Firebase setToCache failed:', err);
    }
    return;
  } else if (hasKV) {
    try {
      await runRedisCommand(['SET', `nibokuu:cache:${key}`, JSON.stringify(data), 'EX', ttlSeconds.toString()]);
    } catch (err) {
      console.error('Vercel KV setToCache failed:', err);
    }
    return;
  }

  // Memory cache fallback
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

// Global registry for in-progress scrapes to survive hot-reloading in local dev server
const globalRef = global as any;
if (!globalRef.activeScrapes) {
  globalRef.activeScrapes = new Map<string, Promise<any>>();
}
const activeScrapes = globalRef.activeScrapes;

/**
 * Coalesces concurrent duplicate requests (Single Flight pattern) to reuse in-flight scraping promises.
 */
export async function coalesceScrape<T>(key: string, scrapeFn: () => Promise<T>): Promise<T> {
  const active = activeScrapes.get(key);
  if (active) {
    console.log(`[SingleFlight] Scrape already in progress for key: ${key}. Awaiting existing promise...`);
    return active;
  }

  const promise = (async () => {
    try {
      return await scrapeFn();
    } finally {
      activeScrapes.delete(key);
    }
  })();

  activeScrapes.set(key, promise);
  return promise;
}
