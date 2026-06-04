import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface GenreItem {
  text: string;
  value: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  // 1. Check Cache first
  const cacheKey = 'anime_genres_list';
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log('Serving genres list from cache.');
    await logRequest(endpoint, 'GET', '200 OK', 200, Date.now() - startTime, true);
    return NextResponse.json(cachedData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=59',
      },
    });
  }

  try {
    const successResponse = await coalesceScrape(cacheKey, async () => {
      let browser;
      try {
        // 2. Launch browser using centralized utility
        browser = await launchBrowser();

        // 3. Resolve target URL dynamically from the landing page
        const targetUrl = await resolveDomain(browser);
        const filterPageUrl = `${targetUrl}daftar-anime-2/`;

        // 4. Open filter URL and scrape genres list
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${filterPageUrl} to scrape genres...`);
        await page.goto(filterPageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait for filter sidebar / genres list to populate
        await page.waitForFunction(
          () => !!(document.querySelector('input[name="genre[]"]') || document.querySelector('.taxo-genre') || document.querySelector('.filter_ak')),
          { timeout: 20000 }
        ).catch((err) => {
          console.warn('Timeout waiting for genre elements, parsing current DOM state anyway.', err.message);
        });

        const htmlData = await page.content();
        await browser.close();
        browser = null; // Mark as closed

        // 5. Parse content using Cheerio
        const $ = cheerio.load(htmlData);
        const genresList: GenreItem[] = [];

        $('input[name="genre[]"]').each((_, element) => {
          const value = $(element).val() || $(element).attr('value') || '';
          const label = $(element).parent().text().trim();
          
          if (label && value && value !== 'on') {
            genresList.push({
              text: label,
              value: value.toString()
            });
          }
        });

        console.log(`Genres scraping complete. Found ${genresList.length} items.`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          total_genres: genresList.length,
          data: genresList
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

              const screenshotPath = path.join(publicDir, 'debug-genres-error.png');
              const htmlPath = path.join(publicDir, 'debug-genres-error.html');

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
    console.error("Genres Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during genres scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-genres-error.png and debug-genres-error.html).'
    }, { status: 500 });
  }
}
