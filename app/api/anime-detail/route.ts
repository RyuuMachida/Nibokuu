import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface DetailResponse {
  status: string;
  project: string;
  title: string;
  rating: string;
  synopsis: string;
  image: string | undefined;
  genres: string[];
  metadata: Record<string, string | string[]>;
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
  const cacheKey = `anime-detail:${targetUrl.trim().toLowerCase()}`;
  if (!bypassCache || !isAuth) {
    const cachedData = await getFromCache<any>(cacheKey);
    if (cachedData) {
      console.log(`Serving anime details for "${targetUrl}" from cache.`);
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

        console.log(`Navigating to target anime detail page: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait for main content wrapper to load
        await page.waitForFunction(
          () => !!(document.querySelector('.anime-info') || document.querySelector('.infox') || document.querySelector('.entry-title')),
          { timeout: 20000 }
        ).catch((err) => {
          console.warn('Timeout waiting for detail selectors. Parsing current DOM state.', err.message);
        });

        const htmlData = await page.content();
        await browser.close();
        browser = null; // Mark as closed

        // 3. Parse HTML using Cheerio
        const $ = cheerio.load(htmlData);

        // Extract Title
        const title = $('.anime-info h1.entry-title, h1.entry-title').first().text().trim();

        // Extract Rating
        const rating = $('.rating strong, .score, [itemprop="ratingValue"]').text().trim();

        // Extract Synopsis
        const synopsis = $('.entry-content, [itemprop="description"], .desc, .sinopsis').first().text().trim();

        // Extract Poster Image
        const image = $('.thumb img, .poster img').first().attr('src') || $('.thumb img, .poster img').first().attr('data-src');

        // Extract Genres
        const genres: string[] = [];
        $('.genre-info a').each((_, el) => {
          const gText = $(el).text().trim();
          if (gText) {
            genres.push(gText);
          }
        });

        // Extract Spe/Metadata
        const metadata: Record<string, string | string[]> = {};
        $('.spe span, .info-content span, .info_anime span').each((_, el) => {
          const rawKey = $(el).find('b').text().replace(':', '').trim();
          if (rawKey) {
            // Remove <b> tag to extract remaining text cleanly
            const clonedEl = $(el).clone();
            clonedEl.find('b').remove();

            // Check if there are tag links (like producers, studios, season)
            const links: string[] = [];
            clonedEl.find('a').each((_, aEl) => {
              const aText = $(aEl).text().trim();
              if (aText) links.push(aText);
            });

            const cleanKey = rawKey.toLowerCase();
            if (links.length > 0) {
              metadata[cleanKey] = links;
            } else {
              metadata[cleanKey] = clonedEl.text().replace(/^\s*:\s*/, '').trim(); // Remove leading colon if present
            }
          }
        });

        console.log(`Successfully scraped anime details: "${title}"`);

        const responseData: DetailResponse = {
          status: 'success',
          project: 'Nibokuu API',
          title,
          rating,
          synopsis,
          image,
          genres,
          metadata
        };

        // Store in cache for 24 hours (86400 seconds)
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

              const screenshotPath = path.join(publicDir, 'debug-detail-error.png');
              const htmlPath = path.join(publicDir, 'debug-detail-error.html');

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
    console.error("Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during anime detail scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-detail-error.png and debug-detail-error.html).'
    }, { status: 500 });
  }
}
