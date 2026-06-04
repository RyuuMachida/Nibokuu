import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain } from '@/lib/resolver';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface ScheduleItem {
  title: string;
  link: string;
  image: string;
  type: string;
  score: string;
  genres: string[];
  time: string;
}

interface GroupedSchedule {
  day: string;
  total: number;
  data: ScheduleItem[];
}

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatScheduleItem(item: any): ScheduleItem {
  // Parse genres: "Action, Adventure" -> ["Action", "Adventure"]
  const genres = item.genre
    ? item.genre.split(',').map((g: string) => g.trim()).filter(Boolean)
    : [];

  return {
    title: item.title || '',
    link: item.url || '',
    image: item.featured_img_src || '',
    type: item.east_type || '',
    score: item.east_score || '',
    genres,
    time: item.east_time || ''
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const { searchParams } = new URL(request.url);
  const dayParam = searchParams.get('day')?.toLowerCase() || '';

  // Validate day param if provided
  if (dayParam && !VALID_DAYS.includes(dayParam)) {
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '400 Bad Request', 400, latency, false);
    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: `Invalid day parameter. Must be one of: ${VALID_DAYS.join(', ')}`
    }, { status: 400 });
  }

  // 1. Check Cache first
  const cacheKey = `schedule:${dayParam || 'all'}`;
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log(`Serving schedule (${dayParam || 'all'}) from cache.`);
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
        const schedulePageUrl = `${targetUrl}jadwal-rilis/`;

        console.log(`Establishing session on schedule page: ${schedulePageUrl}`);

        const pageInstance = await browser.newPage();
        await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await pageInstance.goto(schedulePageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Ensure page has loaded enough to execute fetch requests
        await pageInstance.waitForSelector('#the-days, .east_days_option', { timeout: 15000 }).catch((err) => {
          console.warn('Timeout waiting for schedule days elements. Continuing to evaluate fetch.', err.message);
        });

        let responseData: any;

        // 4. Fetch from the internal WP JSON API using browser context to bypass Cloudflare
        if (dayParam) {
          console.log(`Fetching schedule for single day: ${dayParam}`);
          const rawData = await pageInstance.evaluate(async (dayVal) => {
            try {
              const response = await fetch(`/wp-json/custom/v1/all-schedule?perpage=20&day=${dayVal}`);
              return await response.json();
            } catch (err: any) {
              return { error: err.message };
            }
          }, dayParam);

          if (rawData.error) {
            throw new Error(`Browser context fetch failed: ${rawData.error}`);
          }

          const items = Array.isArray(rawData) ? rawData.map(formatScheduleItem) : [];
          responseData = {
            status: 'success',
            project: 'Nibokuu API',
            day: dayParam,
            total: items.length,
            data: items
          };
        } else {
          console.log('Fetching schedule for all days in parallel...');
          const rawAllDays = await pageInstance.evaluate(async () => {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const fetches = days.map(async (d) => {
              try {
                const response = await fetch(`/wp-json/custom/v1/all-schedule?perpage=20&day=${d}`);
                const json = await response.json();
                return { day: d, data: json };
              } catch (err) {
                return { day: d, data: [] };
              }
            });
            return Promise.all(fetches);
          });

          const grouped: GroupedSchedule[] = rawAllDays.map((dObj: any) => {
            const items = Array.isArray(dObj.data) ? dObj.data.map(formatScheduleItem) : [];
            return {
              day: dObj.day,
              total: items.length,
              data: items
            };
          });

          responseData = {
            status: 'success',
            project: 'Nibokuu API',
            total_days: grouped.length,
            data: grouped
          };
        }

        await browser.close();
        browser = null; // Mark as closed

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

              const screenshotPath = path.join(publicDir, 'debug-schedule-error.png');
              const htmlPath = path.join(publicDir, 'debug-schedule-error.html');

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
    console.error("Schedule Scraping Error:", error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during schedule scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-schedule-error.png and debug-schedule-error.html).'
    }, { status: 500 });
  }
}

