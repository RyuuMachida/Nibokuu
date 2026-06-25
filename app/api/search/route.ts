import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface SearchResult {
  title: string;
  link: string | undefined;
  image: string | undefined;
  type: string;
  score: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const bypassCache = searchParams.get('bypass_cache') === 'true' || searchParams.get('force') === 'true';

  if (!query) {
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '400 Bad Request', 400, latency, false);
    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: 'Parameter "q" is required.'
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
  const cacheKey = `search:${query.trim().toLowerCase()}`;
  if (!bypassCache || !isAuth) {
    const cachedData = await getFromCache<any>(cacheKey);
    if (cachedData) {
      console.log(`Serving search query "${query}" from cache.`);
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

        // 3. Resolve active target URL dynamically from the landing page
        const targetUrl = await resolveDomain(browser);

        // 4. Perform search request
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const searchUrl = `${targetUrl}?s=${encodeURIComponent(query)}`;
        console.log(`Searching for "${query}" at: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

        // Wait briefly for content to populate
        await page.waitForFunction(
          () => !!(document.querySelector('.animepost') || document.querySelector('article.animpost') || document.querySelector('.bsx') || document.querySelector('.page-title') || document.querySelector('.notfound')),
          { timeout: 15000 }
        ).catch((err) => {
          console.warn('Timeout waiting for search selectors, parsing current DOM state.', err.message);
        });

        const htmlData = await page.content();
        await browser.close();
        browser = null; // Mark as closed

        // 5. Parse search results using Cheerio
        const $ = cheerio.load(htmlData);
        const searchResults: SearchResult[] = [];

        const posts = $('.animepost, .bsx');
        posts.each((_, element) => {
          const title = $(element).find('.title h2, .tt h2').first().text().trim() || 
                        $(element).find('a').attr('oldtitle')?.trim() || 
                        $(element).find('a').attr('title')?.trim() || 
                        $(element).find('img').attr('title')?.trim() ||
                        $(element).find('img').attr('alt')?.trim() ||
                        $(element).find('.title, .tt').first().text().trim();
          const link = $(element).find('a').attr('href');
          const image = $(element).find('img').attr('src') || $(element).find('img').attr('data-src');
          
          // Select the first type class text or from data
          const type = $(element).find('.type, .typez').first().text().trim();
          const score = $(element).find('.score').text().trim();

          if (title && link) {
            // Strip duplicate whitespace and newlines from title
            const cleanTitle = title.replace(/\s+/g, ' ').trim();
            searchResults.push({
              title: cleanTitle,
              link,
              image,
              type,
              score
            });
          }
        });

        console.log(`Search complete. Found ${searchResults.length} results.`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          query,
          total_results: searchResults.length,
          data: searchResults
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

              // Ensure public directory exists
              const publicDir = path.join(process.cwd(), 'public');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }

              const screenshotPath = path.join(publicDir, 'debug-search-error.png');
              const htmlPath = path.join(publicDir, 'debug-search-error.html');

              await activePage.screenshot({ path: screenshotPath, fullPage: true });
              const htmlContent = await activePage.content();
              fs.writeFileSync(htmlPath, htmlContent);

              console.log(`Diagnostics saved to: ${screenshotPath} and ${htmlPath}`);
            }
          } catch (diagError) {
            console.error("Failed to save search diagnostics:", diagError);
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
    console.error("Search Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during search scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-search-error.png and debug-search-error.html).'
    }, { status: 500 });
  }
}

