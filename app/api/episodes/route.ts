import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';
import { sanitizeSamehadakuUrl } from '@/lib/resolver';

interface EpisodeItem {
  episode: string;
  title: string;
  link: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const bypassCache = searchParams.get('bypass_cache') === 'true' || searchParams.get('force') === 'true';

  if (!targetUrl) {
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '400 Bad Request', 400, latency, false);
    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: 'Parameter "url" is required.'
    }, { status: 400 });
  }

  const activeDomain = await getFromCache<string>('resolved_samehadaku_domain') || 'https://v2.samehadaku.how/';
  // Sanitize input URL first
  const sanitizedTargetUrl = sanitizeSamehadakuUrl(targetUrl, activeDomain) || targetUrl;

  let isAuth = false;
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  if (bypassCache && expectedKey) {
    const authHeader = request.headers.get('Authorization');
    const secretParam = searchParams.get('secret');
    if (authHeader === `Bearer ${expectedKey}` || secretParam === expectedKey) {
      isAuth = true;
    }
  }

  // 1. Check Cache first
  const cacheKey = `episodes:${sanitizedTargetUrl.trim().toLowerCase()}`;
  if (!bypassCache || !isAuth) {
    const cachedData = await getFromCache<any>(cacheKey);
    if (cachedData) {
      console.log(`Serving episodes list for "${sanitizedTargetUrl}" from cache.`);
      
      // Sanitize cache results on-the-fly to cover any domain updates
      if (cachedData.episodes && Array.isArray(cachedData.episodes)) {
        cachedData.episodes = cachedData.episodes.map((ep: any) => ({
          ...ep,
          link: sanitizeSamehadakuUrl(ep.link, activeDomain)
        }));
      }
      
      await logRequest(endpoint, 'GET', '200 OK', 200, Date.now() - startTime, true);
      return NextResponse.json(cachedData, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=59',
        },
      });
    }
  }

  try {
    const successResponse = await coalesceScrape(cacheKey, async () => {
      let browser;
      try {
        // 2. Launch browser using centralized utility
        browser = await launchBrowser();

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to target anime detail page: ${sanitizedTargetUrl}`);
        await page.goto(sanitizedTargetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        console.log('Waiting for episode list...');
        await page.waitForSelector('.eplister, .listeps', { timeout: 15000 }).catch((err) => {
          console.warn('Timeout waiting for episode list selector.', err.message);
        });

        const htmlData = await page.content();
        await browser.close();
        browser = null; // Mark as closed

        // 3. Parse HTML using Cheerio
        const $ = cheerio.load(htmlData);
        
        // Extract Title
        const title = $('.anime-info h1.entry-title, h1.entry-title').first().text().trim() || 
                      $('title').text().replace('- Samehadaku', '').trim();

        // Extract episodes list from .eplister / .listeps
        const episodes: EpisodeItem[] = [];
        $('.eplister li, .listeps li').each((_, el) => {
          const anchor = $(el).find('a');
          const epTitle = anchor.find('.epl-title').text().trim() || $(el).find('.epsleft .lchx a').text().trim() || anchor.text().trim();
          const link = anchor.attr('href');
          const epNum = anchor.find('.epl-num').text().trim() || $(el).find('.epsright .eps a').text().trim() || $(el).find('.epsright .eps').text().trim();
          if (link) {
            episodes.push({
              episode: epNum,
              title: epTitle || `Episode ${epNum}`,
              link: sanitizeSamehadakuUrl(link, activeDomain) || link
            });
          }
        });
        
        // Reverse to display episodes from 1 to max episode
        episodes.reverse();

        console.log(`Successfully scraped episodes list: "${title}" (episodes: ${episodes.length})`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          title,
          total_episodes: episodes.length,
          episodes
        };

        // Cache episodes list for 24 hours (86400 seconds)
        await setToCache(cacheKey, responseData, 86400);

        return responseData;
      } catch (innerError: any) {
        if (browser) {
          try {
            const pages = await browser.pages();
            if (pages.length > 0) {
              const activePage = pages[pages.length - 1];

              const publicDir = path.join(process.cwd(), 'public');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }

              const screenshotPath = path.join(publicDir, 'debug-episodes-error.png');
              const htmlPath = path.join(publicDir, 'debug-episodes-error.html');

              await activePage.screenshot({ path: screenshotPath, fullPage: true });
              const htmlContent = await activePage.content();
              fs.writeFileSync(htmlPath, htmlContent);

              console.log(`Diagnostics saved to: ${screenshotPath} and ${htmlPath}`);
            }
          } catch (diagError) {
            console.error("Failed to save diagnostics:", diagError);
          }
          try {
            await browser.close();
          } catch (closeError) {
            console.error("Failed to close browser:", closeError);
          }
        }
        throw innerError;
      }
    });

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '200 OK', 200, latency, false);

    return NextResponse.json(successResponse, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=59',
      },
    });

  } catch (error: any) {
    console.error("Episodes Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during episodes list scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-episodes-error.png and debug-episodes-error.html).'
    }, { status: 500 });
  }
}
