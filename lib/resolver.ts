import * as cheerio from 'cheerio';
import { getFromCache, setToCache, coalesceScrape } from './cache';

/**
 * Resolves the active Samehadaku domain dynamically by querying the landing page.
 * Caches the resolved domain in memory for 1 hour to optimize performance.
 * Falls back to a default domain if resolution fails.
 */
export async function resolveDomain(browser: any): Promise<string> {
  const cacheKey = 'resolved_samehadaku_domain';
  const cachedDomain = await getFromCache<string>(cacheKey);

  if (cachedDomain) {
    console.log(`Using cached active domain: ${cachedDomain}`);
    return cachedDomain;
  }

  return await coalesceScrape(cacheKey, async () => {
    // Check cache again inside to handle concurrent race conditions
    const cachedAgain = await getFromCache<string>(cacheKey);
    if (cachedAgain) {
      console.log(`Using cached active domain (resolved by concurrent request): ${cachedAgain}`);
      return cachedAgain;
    }

    const fallbackUrl = 'https://samehadaku.li/';
    let targetUrl = fallbackUrl;

    try {
      const landingPage = await browser.newPage();
      await landingPage.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      console.log('Resolving active domain dynamically from samehadaku.care...');
      await landingPage.goto('https://samehadaku.care/', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      const landingHtml = await landingPage.content();
      const $landing = cheerio.load(landingHtml);

      let foundUrl = '';
      $landing('a').each((_, el) => {
        const href = $landing(el).attr('href');
        if (
          href &&
          href.match(/https?:\/\/(?:v\d+\.)?samehadaku\.[a-z]+/i) &&
          !href.includes('samehadaku.care')
        ) {
          foundUrl = href;
          return false; // Break loop
        }
      });

      if (foundUrl) {
        let tempUrl = foundUrl.endsWith('/') ? foundUrl : foundUrl + '/';
        // Override outdated samehadaku.how domains to the new active samehadaku.li
        if (tempUrl.includes('samehadaku.how')) {
          console.log('Resolved domain contains samehadaku.how (outdated). Overriding to samehadaku.li');
          targetUrl = 'https://samehadaku.li/';
        } else {
          targetUrl = tempUrl;
        }
        console.log(`Dynamic domain resolution succeeded. Target URL: ${targetUrl}`);
        // Cache target URL for 24 hours (86400 seconds)
        await setToCache(cacheKey, targetUrl, 86400);
      } else {
        console.warn('Could not extract target URL from landing page. Using fallback.');
      }
      await landingPage.close();
    } catch (landingError) {
      console.error('Failed dynamic domain resolution. Using default fallback.', landingError);
    }

    return targetUrl;
  });
}

