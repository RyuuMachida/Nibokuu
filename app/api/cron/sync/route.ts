import { NextRequest, NextResponse } from 'next/server';
import { getFromCache } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel Pro if needed

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const expectedKey = process.env.ADMIN_SECRET_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('Authorization');
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get('secret');

  // Authorize caller
  let isAuthorized = false;
  if (expectedKey && (authHeader === `Bearer ${expectedKey}` || secretParam === expectedKey)) {
    isAuthorized = true;
  }
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '401 Unauthorized', 401, latency, false);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Unauthorized access.' 
    }, { status: 401 });
  }

  try {
    const origin = request.nextUrl.origin;
    console.log(`[Cron Sync] Fetching recent episodes from: ${origin}/api/recent`);

    // Fetch fresh recent updates from Samehadaku homepage
    const recentRes = await fetch(`${origin}/api/recent?bypass_cache=true&secret=${expectedKey}`, {
      headers: {
        'Authorization': `Bearer ${expectedKey}`
      }
    });

    if (!recentRes.ok) {
      throw new Error(`Failed to fetch recent updates: ${recentRes.statusText}`);
    }

    const recentData = await recentRes.json();
    const episodes = recentData.data || [];
    console.log(`[Cron Sync] Found ${episodes.length} recent episodes. Checking cache status...`);

    // Identify which episodes are uncached in Firebase
    const uncachedEpisodes: string[] = [];
    for (const ep of episodes) {
      if (!ep.link) continue;
      const cacheKey = `episode:${ep.link.trim().toLowerCase()}`;
      const cached = await getFromCache(cacheKey);
      if (!cached) {
        uncachedEpisodes.push(ep.link);
      }
    }

    console.log(`[Cron Sync] Out of ${episodes.length} episodes, ${uncachedEpisodes.length} are new/uncached.`);

    const results: string[] = [];
    const errors: string[] = [];
    const concurrencyLimit = 2;

    if (uncachedEpisodes.length > 0) {
      console.log(`[Cron Sync] Triggering background pre-caching with concurrency limit of ${concurrencyLimit}...`);
      
      const executing = new Set<Promise<void>>();
      for (const link of uncachedEpisodes) {
        const promise = (async () => {
          try {
            console.log(`[Cron Sync] Scraping new episode: ${link}`);
            const res = await fetch(`${origin}/api/episode?url=${encodeURIComponent(link)}&bypass_cache=true&secret=${expectedKey}`, {
              headers: {
                'Authorization': `Bearer ${expectedKey}`
              },
              signal: AbortSignal.timeout(60000) // 60 seconds max per scrape
            });
            if (res.ok) {
              results.push(link);
              console.log(`[Cron Sync] Successfully scraped and cached: ${link}`);
            } else {
              const errText = await res.text().catch(() => '');
              errors.push(`${link} (Status ${res.status}: ${errText})`);
              console.error(`[Cron Sync] Scraper endpoint returned status ${res.status} for: ${link}`);
            }
          } catch (err: any) {
            errors.push(`${link} (Error: ${err.message})`);
            console.error(`[Cron Sync] Failed to run scrape for: ${link}`, err);
          }
        })();

        executing.add(promise);
        promise.then(() => executing.delete(promise));

        if (executing.size >= concurrencyLimit) {
          await Promise.race(executing);
        }
      }
      // Await remaining tasks
      await Promise.all(executing);
    }

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '200 OK', 200, latency, false);

    console.log(`[Cron Sync] Finished cron run in ${latency}ms. Processed: ${results.length}, Errors: ${errors.length}`);

    return NextResponse.json({
      status: 'success',
      project: 'Nibokuu API',
      checked: episodes.length,
      newEpisodesFound: uncachedEpisodes.length,
      processed: results,
      errors: errors.length > 0 ? errors : undefined,
      latency: `${latency}ms`
    });

  } catch (error: any) {
    console.error('[Cron Sync] Error:', error);
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during cron sync.'
    }, { status: 500 });
  }
}
