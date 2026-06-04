import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface BatchListItem {
  title: string;
  link: string | undefined;
  image: string | undefined;
  type: string;
  score: string;
  genres: string[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page') || '1';
  const page = parseInt(pageParam, 10) || 1;

  // 1. Check Cache first
  const cacheKey = `batch:${page}`;
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log(`Serving batch list page ${page} from cache.`);
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

        // 3. Resolve active target URL dynamically from the landing page
        const targetUrl = await resolveDomain(browser);

        const pagePath = page > 1 ? `page/${page}/` : '';
        const batchListUrl = `${targetUrl}daftar-batch/${pagePath}`;

        console.log(`Navigating to Batch List at: ${batchListUrl}`);

        const pageInstance = await browser.newPage();
        await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await pageInstance.goto(batchListUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait briefly for content to populate
        await pageInstance.waitForFunction(
          () => !!(document.querySelector('.animepost') || document.querySelector('article.animpost') || document.querySelector('.page-title') || document.querySelector('.notfound')),
          { timeout: 20000 }
        ).catch((err) => {
          console.warn('Timeout waiting for batch list selectors, parsing current DOM state.', err.message);
        });

        const htmlData = await pageInstance.content();
        await browser.close();
        browser = null; // Mark as closed

        // 4. Parse content using Cheerio
        const $ = cheerio.load(htmlData);
        const batchList: BatchListItem[] = [];

        $('.animepost').each((_, element) => {
          const itemTitle = $(element).find('.title h2').text().trim() || 
                            $(element).find('a').attr('title')?.trim() || 
                            $(element).find('.title').text().trim();
          const link = $(element).find('a').attr('href');
          const image = $(element).find('img').attr('src');
          const itemType = $(element).find('.type').first().text().trim();
          const score = $(element).find('.score').text().trim();

          // Extract genres from the tooltip inside the same article item if available
          const itemGenres: string[] = [];
          $(element).find('.stooltip .genres .mta a').each((_, gEl) => {
            const gText = $(gEl).text().trim();
            if (gText) {
              itemGenres.push(gText);
            }
          });

          if (itemTitle && link) {
            const cleanTitle = itemTitle.replace(/\s+/g, ' ').trim();
            batchList.push({
              title: cleanTitle,
              link,
              image,
              type: itemType,
              score,
              genres: itemGenres
            });
          }
        });

        console.log(`Scraped batch page ${page}. Found ${batchList.length} items.`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          page,
          total_data: batchList.length,
          data: batchList
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

              const screenshotPath = path.join(publicDir, 'debug-batch-error.png');
              const htmlPath = path.join(publicDir, 'debug-batch-error.html');

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
    console.error("Batch List Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during batch list scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-batch-error.png and debug-batch-error.html).'
    }, { status: 500 });
  }
}

