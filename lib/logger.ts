interface RequestLog {
  id: string;
  endpoint: string;
  method: string;
  status: string;
  statusCode: number;
  latency: string;
  timestamp: string;
}

// Global declaration references to survive hot-reloading in local dev server
const globalRef = global as any;
if (globalRef.totalRequests === undefined) globalRef.totalRequests = 0;
if (globalRef.cacheHits === undefined) globalRef.cacheHits = 0;
if (globalRef.cacheMisses === undefined) globalRef.cacheMisses = 0;
if (globalRef.successRequests === undefined) globalRef.successRequests = 0;
if (globalRef.failedRequests === undefined) globalRef.failedRequests = 0;
if (globalRef.logsList === undefined) globalRef.logsList = [];

/**
 * Executes a Redis command against the Vercel KV REST API using native fetch.
 */
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
    console.error('Failed to run Vercel KV command:', error);
    return null;
  }
}

/**
 * Logs an incoming API request.
 */
export async function logRequest(
  endpoint: string,
  method: string,
  status: string,
  statusCode: number,
  latencyMs: number,
  isCacheHit: boolean
): Promise<void> {
  const now = new Date();
  // Format current local time HH:MM:SS
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  // Sanitize sensitive query parameters (like secrets or keys) from the endpoint path before logging
  const sanitizedEndpoint = endpoint.replace(/([?&])(secret|cron_secret|key|token)=[^&]*/gi, '$1$2=[MASKED]');

  const logEntry: RequestLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    endpoint: sanitizedEndpoint,
    method,
    status,
    statusCode,
    latency: `${latencyMs}ms`,
    timestamp,
  };

  const hasFirebase = !!process.env.FIREBASE_DATABASE_URL;
  const hasKV = !hasFirebase && !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const isSuccess = statusCode >= 200 && statusCode < 400;

  if (hasFirebase) {
    try {
      let dbUrl = process.env.FIREBASE_DATABASE_URL || '';
      if (!dbUrl.endsWith('/')) dbUrl += '/';
      const secret = process.env.FIREBASE_DATABASE_SECRET || '';
      const authQuery = secret ? `?auth=${secret}` : '';

      const statsPatch: any = {
        totalRequests: { ".sv": { "increment": 1 } }
      };
      if (isCacheHit) {
        statsPatch.cacheHits = { ".sv": { "increment": 1 } };
      } else {
        statsPatch.cacheMisses = { ".sv": { "increment": 1 } };
      }
      if (isSuccess) {
        statsPatch.successRequests = { ".sv": { "increment": 1 } };
      } else {
        statsPatch.failedRequests = { ".sv": { "increment": 1 } };
      }

      await Promise.all([
        fetch(`${dbUrl}nibokuu/stats.json${authQuery}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statsPatch)
        }),
        fetch(`${dbUrl}nibokuu/logs.json${authQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry)
        })
      ]);
    } catch (err) {
      console.error('Firebase RTDB logRequest failed:', err);
    }
  } else if (hasKV) {
    try {
      // 1. Increment request counter
      await runRedisCommand(['INCR', 'nibokuu:total_requests']);

      // 2. Increment hit/miss counters
      if (isCacheHit) {
        await runRedisCommand(['INCR', 'nibokuu:cache_hits']);
      } else {
        await runRedisCommand(['INCR', 'nibokuu:cache_misses']);
      }

      // 3. Increment success/failed counters
      if (isSuccess) {
        await runRedisCommand(['INCR', 'nibokuu:success_requests']);
      } else {
        await runRedisCommand(['INCR', 'nibokuu:failed_requests']);
      }

      // 4. Push log to list and trim to max 50 entries
      const jsonStr = JSON.stringify(logEntry);
      await runRedisCommand(['LPUSH', 'nibokuu:logs', jsonStr]);
      await runRedisCommand(['LTRIM', 'nibokuu:logs', '0', '49']);
    } catch (err) {
      console.error('Vercel KV logRequest failed:', err);
    }
  } else {
    // Local in-memory fallback
    globalRef.totalRequests += 1;
    if (isCacheHit) {
      globalRef.cacheHits += 1;
    } else {
      globalRef.cacheMisses += 1;
    }
    if (isSuccess) {
      globalRef.successRequests += 1;
    } else {
      globalRef.failedRequests += 1;
    }
    globalRef.logsList = [logEntry, ...globalRef.logsList].slice(0, 50);
    console.log(`[Logger - In Memory] Logged ${method} ${endpoint} (${latencyMs}ms)`);
  }
}

/**
 * Retrieves compiled system metrics and logs.
 */
export async function getSystemStats(): Promise<{
  totalRequests: number;
  cacheHitRatio: number;
  successRequests: number;
  failedRequests: number;
  logs: RequestLog[];
}> {
  const hasFirebase = !!process.env.FIREBASE_DATABASE_URL;
  const hasKV = !hasFirebase && !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (hasFirebase) {
    try {
      let dbUrl = process.env.FIREBASE_DATABASE_URL || '';
      if (!dbUrl.endsWith('/')) dbUrl += '/';
      const secret = process.env.FIREBASE_DATABASE_SECRET || '';
      const authQuery = secret ? `?auth=${secret}` : '';

      const [statsRes, logsRes] = await Promise.all([
        fetch(`${dbUrl}nibokuu/stats.json${authQuery}`),
        fetch(`${dbUrl}nibokuu/logs.json${authQuery}${authQuery ? '&' : '?'}orderBy="$key"&limitToLast=20`)
      ]);

      const statsData = await statsRes.json() || {};
      const logsObj = await logsRes.json();

      const totalRequests = statsData.totalRequests || 0;
      const hits = statsData.cacheHits || 0;
      const misses = statsData.cacheMisses || 0;
      const successRequests = statsData.successRequests || 0;
      const failedRequests = statsData.failedRequests || 0;

      const cacheHitRatio = totalRequests > 0 && (hits + misses) > 0
        ? parseFloat(((hits / (hits + misses)) * 100).toFixed(1))
        : 0;

      const logs: RequestLog[] = [];
      if (logsObj && typeof logsObj === 'object') {
        const sortedKeys = Object.keys(logsObj).sort().reverse();
        for (const key of sortedKeys) {
          logs.push(logsObj[key]);
        }
      }

      return {
        totalRequests,
        cacheHitRatio,
        successRequests,
        failedRequests,
        logs
      };
    } catch (err) {
      console.error('Firebase RTDB getSystemStats failed:', err);
    }
  } else if (hasKV) {
    try {
      const totalRaw = await runRedisCommand(['GET', 'nibokuu:total_requests']);
      const hitsRaw = await runRedisCommand(['GET', 'nibokuu:cache_hits']);
      const missesRaw = await runRedisCommand(['GET', 'nibokuu:cache_misses']);
      const successRaw = await runRedisCommand(['GET', 'nibokuu:success_requests']);
      const failedRaw = await runRedisCommand(['GET', 'nibokuu:failed_requests']);
      const logsRaw = await runRedisCommand(['LRANGE', 'nibokuu:logs', '0', '19']);

      const totalRequests = parseInt(totalRaw, 10) || 0;
      const hits = parseInt(hitsRaw, 10) || 0;
      const misses = parseInt(missesRaw, 10) || 0;
      const successRequests = parseInt(successRaw, 10) || 0;
      const failedRequests = parseInt(failedRaw, 10) || 0;

      const cacheHitRatio = totalRequests > 0 && (hits + misses) > 0
        ? parseFloat(((hits / (hits + misses)) * 100).toFixed(1))
        : 0;

      const logs: RequestLog[] = Array.isArray(logsRaw)
        ? logsRaw.map((logStr: string) => {
            try {
              return JSON.parse(logStr);
            } catch {
              return null;
            }
          }).filter(Boolean)
        : [];

      return {
        totalRequests,
        cacheHitRatio,
        successRequests,
        failedRequests,
        logs,
      };
    } catch (err) {
      console.error('Vercel KV getSystemStats failed:', err);
    }
  }

  // Fallback to local memory values
  const hits = globalRef.cacheHits;
  const misses = globalRef.cacheMisses;
  const totalRequests = globalRef.totalRequests;
  const successRequests = globalRef.successRequests;
  const failedRequests = globalRef.failedRequests;
  const cacheHitRatio = (hits + misses) > 0
    ? parseFloat(((hits / (hits + misses)) * 100).toFixed(1))
    : 0;

  return {
    totalRequests,
    cacheHitRatio,
    successRequests,
    failedRequests,
    logs: globalRef.logsList,
  };
}
