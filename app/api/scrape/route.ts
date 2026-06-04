import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface AnimeData {
  title: string;
  episode: string;
  thumbnail: string | undefined;
  link: string | undefined;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  // 1. Check Cache first
  const cacheKey = 'recent_updates';
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log('Serving recent updates from cache.');
    await logRequest(endpoint, 'GET', '200 OK', 200, Date.now() - startTime, true);
    return NextResponse.json(cachedData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=59',
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

        // 4. Open target URL and scrape the content
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Wait for at least one expected selector
        console.log('Waiting for content to load...');
        await page.waitForFunction(
          () => !!(document.querySelector('.post-show') || document.querySelector('.animepost') || document.querySelector('.bsx')),
          { timeout: 20000 }
        );

        const htmlData = await page.content();
        await browser.close(); 
        browser = null; // Mark as closed

        // 5. Parse content using Cheerio
        const $ = cheerio.load(htmlData);
        const animeList: AnimeData[] = [];

        // Try Primary selector: .post-show ul li
        if ($('.post-show ul li').length > 0) {
          console.log('Scraping using primary selector (.post-show ul li)...');
          $('.post-show ul li').each((_, element) => {
            const title = $(element).find('.dtla .entry-title a').text().trim();
            const link = $(element).find('.thumb a').attr('href');
            const thumbnail = $(element).find('.thumb a img').attr('src');
            
            let episode = '';
            $(element).find('.dtla span').each((_, el) => {
              const text = $(el).text().trim();
              if (text.includes('Episode')) {
                episode = text.replace(/Episode\s*/i, '').trim();
              }
            });

            if (title && link) {
              animeList.push({ title, episode, thumbnail, link });
            }
          });
        }
        // Try Fallback selector 1: .animepost
        else if ($('.animepost').length > 0) {
          console.log('Scraping using fallback selector (.animepost)...');
          $('.animepost').each((_, element) => {
            const title = $(element).find('.title h2').text().trim();
            const link = $(element).find('a').attr('href');
            const thumbnail = $(element).find('img').attr('src');
            const episode = $(element).find('.epz').text().trim();

            if (title && link) {
              animeList.push({ title, episode, thumbnail, link });
            }
          });
        }
        // Try Fallback selector 2: .bsx
        else if ($('.bsx').length > 0) {
          console.log('Scraping using fallback selector (.bsx)...');
          $('.bsx').each((_, element) => {
            const title = $(element).find('a').attr('title')?.trim() || $(element).find('.tt').text().trim();
            const link = $(element).find('a').attr('href');
            const thumbnail = $(element).find('img').attr('src');
            const episode = $(element).find('.epxs').text().trim();

            if (title && link) {
              animeList.push({ title, episode, thumbnail, link });
            }
          });
        }

        console.log(`Scraping complete. Found ${animeList.length} items.`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          total_data: animeList.length,
          data: animeList
        };

        // Store in cache for 5 minutes (300 seconds)
        await setToCache(cacheKey, responseData, 300);

        return responseData;
      } catch (innerError: any) {
        if (browser) {
          try {
            const pages = await browser.pages(); 
            if (pages.length > 0) {
              const activePage = pages[pages.length - 1];
              
              // Ensure public dir exists
              const publicDir = path.join(process.cwd(), 'public');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }

              const screenshotPath = path.join(publicDir, 'debug-error.png');
              const htmlPath = path.join(publicDir, 'debug-error.html');

              await activePage.screenshot({ path: screenshotPath, fullPage: true });
              const htmlContent = await activePage.content();
              fs.writeFileSync(htmlPath, htmlContent);

              console.log(`Diagnostics saved to: ${screenshotPath} and ${htmlPath}`);
            }
          } catch (diagError) {
            console.error("Failed to save scraping error diagnostics:", diagError);
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
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=59',
      },
    });

  } catch (error: any) {
    console.error("Scraping Error:", error);
    
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during scraping.',
      diagnostics: 'Diagnostics saved in the public directory (debug-error.png and debug-error.html).'
    }, { status: 500 });
  }
}