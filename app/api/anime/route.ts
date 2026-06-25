import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain, sanitizeSamehadakuUrl } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface AnimeListItem {
  title: string;
  link: string | undefined;
  image: string | undefined;
  type: string;
  score: string;
  genres: string[];
  episodes_api_link?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || '';
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';
  const order = searchParams.get('order') || '';
  const genres = searchParams.get('genres') || '';
  const pageParam = searchParams.get('page') || '1';
  const page = parseInt(pageParam, 10) || 1;

  const activeDomain = await getFromCache<string>('resolved_samehadaku_domain') || 'https://v2.samehadaku.how/';

  // 1. Check Cache first
  const cacheKey = `anime:${title.trim().toLowerCase()}:${status.trim().toLowerCase()}:${type.trim().toLowerCase()}:${order.trim().toLowerCase()}:${genres.trim().toLowerCase()}:${page}`;
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log('Serving anime list from cache.');
    
    // Sanitize cached links on the fly to reflect any domain changes instantly
    if (cachedData.data && Array.isArray(cachedData.data)) {
      cachedData.data = cachedData.data.map((item: any) => {
        const cleanLink = sanitizeSamehadakuUrl(item.link, activeDomain);
        return {
          ...item,
          link: cleanLink,
          image: sanitizeSamehadakuUrl(item.image, activeDomain),
          episodes_api_link: `/api/episodes?url=${encodeURIComponent(cleanLink || '')}`
        };
      });
    }
    
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

        // 4. Construct filter query parameters
        const params: string[] = [];
        if (title) params.push(`title=${encodeURIComponent(title)}`);
        if (status) params.push(`status=${encodeURIComponent(status)}`);
        if (type) params.push(`type=${encodeURIComponent(type)}`);
        if (order) params.push(`order=${encodeURIComponent(order)}`);
        
        if (genres) {
          const genreList = genres.split(',');
          for (const genre of genreList) {
            const cleanGenre = genre.trim();
            if (cleanGenre) {
              params.push(`genre%5B%5D=${encodeURIComponent(cleanGenre)}`); // genre[]
            }
          }
        }

        const queryString = params.length > 0 ? `?${params.join('&')}` : '';
        const pagePath = page > 1 ? `page/${page}/` : '';
        const animeListUrl = `${targetUrl}daftar-anime-2/${pagePath}${queryString}`;

        console.log(`Navigating to Anime List at: ${animeListUrl}`);

        const pageInstance = await browser.newPage();
        await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await pageInstance.goto(animeListUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Wait briefly for content to populate
        await pageInstance.waitForFunction(
          () => !!(document.querySelector('.animepost') || document.querySelector('article.animpost') || document.querySelector('.bsx') || document.querySelector('.page-title') || document.querySelector('.notfound')),
          { timeout: 20000 }
        ).catch((err) => {
          console.warn('Timeout waiting for anime list selectors, parsing current DOM state.', err.message);
        });

        const htmlData = await pageInstance.content();
        await browser.close();
        browser = null; // Mark as closed

        // 5. Parse content using Cheerio
        const $ = cheerio.load(htmlData);
        const animeList: AnimeListItem[] = [];

        $('.animepost, .bsx').each((_, element) => {
          const itemTitle = $(element).find('.title h2, .tt h2').first().text().trim() || 
                            $(element).find('a').attr('oldtitle')?.trim() || 
                            $(element).find('a').attr('title')?.trim() || 
                            $(element).find('img').attr('title')?.trim() ||
                            $(element).find('img').attr('alt')?.trim() ||
                            $(element).find('.title, .tt').first().text().trim();
          const link = $(element).find('a').attr('href');
          const image = $(element).find('img').attr('src') || $(element).find('img').attr('data-src');
          const itemType = $(element).find('.type, .typez').first().text().trim();
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
            const cleanLink = sanitizeSamehadakuUrl(link, activeDomain);
            const cleanImage = sanitizeSamehadakuUrl(image, activeDomain);
            animeList.push({
              title: cleanTitle,
              link: cleanLink,
              image: cleanImage,
              type: itemType,
              score,
              genres: itemGenres,
              episodes_api_link: `/api/episodes?url=${encodeURIComponent(cleanLink || '')}`
            });
          }
        });

        console.log(`Scraped anime list page ${page}. Found ${animeList.length} items.`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          page,
          total_data: animeList.length,
          data: animeList
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

              const screenshotPath = path.join(publicDir, 'debug-anime-error.png');
              const htmlPath = path.join(publicDir, 'debug-anime-error.html');

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
    console.error("Anime List Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during anime list scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-anime-error.png and debug-anime-error.html).'
    }, { status: 500 });
  }
}

