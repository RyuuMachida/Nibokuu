import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface PopularItem {
  title: string;
  link: string | undefined;
  image: string | undefined;
  genres: string[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  // 1. Check Cache first
  const cacheKey = 'popular_anime_list';
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log('Serving popular anime list from cache.');
    await logRequest(endpoint, 'GET', '200 OK', 200, Date.now() - startTime, true);
    return NextResponse.json(cachedData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=59',
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

        // 4. Open homepage and scrape popular sidebar widget
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to homepage: ${targetUrl} to scrape popular sidebar...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait for sidebar container to load
        await page.waitForFunction(
          () => !!(document.querySelector('#sidebar') || document.querySelector('.sidebar') || document.querySelector('.serieslist')),
          { timeout: 20000 }
        ).catch((err) => {
          console.warn('Timeout waiting for popular sidebar selectors. Parsing current DOM state anyway.', err.message);
        });

        const htmlData = await page.content();
        await browser.close();
        browser = null; // Mark as closed

        // 5. Parse content using Cheerio
        const $ = cheerio.load(htmlData);
        const popularList: PopularItem[] = [];

        // Scan items inside sidebar (.sidebar, #sidebar, .serieslist, .hot-series)
        // Samehadaku sidebar typically contains .serieslist li or similar.
        const sidebarWrapper = $('#sidebar, .sidebar, .widget-popular, .wpop, .serieslist, .hot-series').first();
        
        sidebarWrapper.find('li, .wseries, .item').each((_, element) => {
          const title = $(element).find('.lftinfo h2 a, h2 a, h4 a, .title a').first().text().trim() ||
                        $(element).find('.imgseries img').attr('title')?.trim();
          const link = $(element).find('.lftinfo h2 a, h2 a, h4 a, .title a, .imgseries a').first().attr('href');
          const image = $(element).find('.imgseries img, img').first().attr('src') ||
                        $(element).find('.imgseries img, img').first().attr('data-src');

          const genres: string[] = [];
          // Loop through all spans to find the one containing genres
          $(element).find('.lftinfo span, span').each((_, spanEl) => {
            const text = $(spanEl).text();
            if (text.includes('Genres') || text.includes('Genre')) {
              $(spanEl).find('a').each((_, aEl) => {
                const gText = $(aEl).text().trim();
                if (gText) genres.push(gText);
              });
            }
          });

          if (title && link) {
            popularList.push({
              title,
              link,
              image,
              genres
            });
          }
        });

        console.log(`Scraped popular sidebar. Found ${popularList.length} items.`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          total_popular: popularList.length,
          data: popularList
        };

        // Store in cache for 4 hours (14400 seconds)
        await setToCache(cacheKey, responseData, 14400);

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

              const screenshotPath = path.join(publicDir, 'debug-popular-error.png');
              const htmlPath = path.join(publicDir, 'debug-popular-error.html');

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
        'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=59',
      },
    });

  } catch (error: any) {
    console.error("Popular List Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during popular list scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-popular-error.png and debug-popular-error.html).'
    }, { status: 500 });
  }
}
