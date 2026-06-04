import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface MirrorData {
  name: string;
  link: string | undefined;
  post?: string;
  nume?: string;
  type?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = request.nextUrl.pathname + request.nextUrl.search;

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '400 Bad Request', 400, latency, false);
    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: 'Parameter "url" is required.'
    }, { status: 400 });
  }

  // 1. Check Cache first
  const cacheKey = `episode:${targetUrl.trim().toLowerCase()}`;
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) {
    console.log(`Serving episode details for "${targetUrl}" from cache.`);
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

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const isAnimeDetail = targetUrl.includes('/anime/');

        console.log(`Navigating to target page: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        if (isAnimeDetail) {
          console.log('Waiting for episode list...');
          await page.waitForSelector('.listeps', { timeout: 15000 }).catch((err) => {
            console.warn('Timeout waiting for episode list selector.', err.message);
          });
        } else {
          // 3. Wait for player container to load its iframe
          console.log('Waiting for video player iframe...');
          await page.waitForFunction(
            () => {
              const iframe = document.querySelector('.player-area iframe') || 
                             document.querySelector('.epsleft iframe') || 
                             document.querySelector('#player iframe') ||
                             document.querySelector('#player_embed iframe');
              return iframe && (iframe as HTMLIFrameElement).src;
            },
            { timeout: 20000 }
          ).catch((err) => {
            console.warn('Timeout waiting for video iframe, parsing current DOM state anyway.', err.message);
          });
        }

        const htmlData = await page.content();

        // 4. Parse HTML using Cheerio
        const $ = cheerio.load(htmlData);
        
        // Extract Title
        const title = $('.entry-header.info_episode h1.entry-title').text().trim() || 
                      $('h1.entry-title').text().trim() || 
                      $('title').text().trim();

        // Extract Iframe URL
        let iframeUrl = '';
        const iframeSelectors = [
          '.player-area iframe',
          '.epsleft iframe',
          '#player iframe',
          '#player_embed iframe'
        ];
        for (const selector of iframeSelectors) {
          const src = $(selector).attr('src');
          if (src && !src.includes('facebook.com') && !src.includes('google.com')) {
            iframeUrl = src;
            break;
          }
        }

        // Extract Alternative Servers / Mirrors
        const mirrors: MirrorData[] = [];

        // Check for streaming options (#server ul li .east_player_option)
        const streamingOptions: { name: string; post: string; nume: string; type: string }[] = [];
        $('#server .east_player_option').each((_, el) => {
          const name = $(el).find('span').text().trim() || $(el).text().trim();
          const post = $(el).attr('data-post');
          const nume = $(el).attr('data-nume');
          const type = $(el).attr('data-type');
          if (name && post && nume && type) {
            streamingOptions.push({ name, post, nume, type });
          }
        });

        // Resolve streaming player options in parallel inside the page context
        console.log(`Resolving ${streamingOptions.length} dynamic player links...`);
        const resolvedStreamingMirrors = await Promise.all(
          streamingOptions.map(async (opt) => {
            try {
              const responseHtml = await page.evaluate(async (p, n, t) => {
                try {
                  const params = new URLSearchParams();
                  params.append('action', 'player_ajax');
                  params.append('post', p);
                  params.append('nume', n);
                  params.append('type', t);
                  
                  const res = await fetch('/wp-admin/admin-ajax.php', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString()
                  });
                  return await res.text();
                } catch (err: any) {
                  return `ERROR: ${err.message}`;
                }
              }, opt.post, opt.nume, opt.type);

              if (responseHtml.startsWith('ERROR') || responseHtml === '0') {
                return { name: opt.name, link: undefined, post: opt.post, nume: opt.nume, type: opt.type };
              }

              const $player = cheerio.load(responseHtml);
              let iframeSrc = $player('iframe').attr('src') || $player('embed').attr('src');
              
              if (!iframeSrc) {
                const match = responseHtml.match(/src="([^"]+)"/) || responseHtml.match(/src='([^']+)'/);
                if (match) {
                  iframeSrc = match[1];
                }
              }

              return {
                name: opt.name,
                link: iframeSrc || undefined,
                post: opt.post,
                nume: opt.nume,
                type: opt.type
              };
            } catch (err) {
              console.error(`Failed to resolve player for ${opt.name}:`, err);
              return { name: opt.name, link: undefined, post: opt.post, nume: opt.nume, type: opt.type };
            }
          })
        );

        for (const sm of resolvedStreamingMirrors) {
          mirrors.push(sm);
        }

        await browser.close();
        browser = null; // Mark as closed


        // Check for alternative lists with class .server or .mirror
        $('.server, .mirror').find('a').each((_, el) => {
          const name = $(el).text().trim();
          const href = $(el).attr('href');
          if (name && href && !href.startsWith('#')) {
            mirrors.push({
              name,
              link: href
            });
          }
        });

        // Check for download links (.download-eps)
        $('.download-eps ul li').each((_, el) => {
          const quality = $(el).find('strong').text().trim();
          $(el).find('span a').each((_, aEl) => {
            const link = $(aEl).attr('href');
            const sourceName = $(aEl).text().trim();
            if (link) {
              mirrors.push({
                name: `${quality ? quality + ' - ' : ''}${sourceName}`,
                link
              });
            }
          });
        });

        // Extract episodes list from .listeps
        const episodes: { title: string; link: string | undefined; episode: string }[] = [];
        $('.listeps li').each((_, el) => {
          const anchor = $(el).find('.epsleft .lchx a');
          const epTitle = anchor.text().trim();
          const link = anchor.attr('href');
          const epNum = $(el).find('.epsright .eps a').text().trim() || $(el).find('.epsright .eps').text().trim();
          if (link) {
            episodes.push({
              title: epTitle || `Episode ${epNum}`,
              link,
              episode: epNum
            });
          }
        });
        // Reverse to display episodes from 1 to max episode
        episodes.reverse();

        console.log(`Successfully scraped: "${title}" (isAnimeDetail: ${isAnimeDetail}, episodes: ${episodes.length})`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          title,
          isAnimeDetail,
          iframeUrl: iframeUrl || undefined,
          mirrors,
          episodes
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

              const screenshotPath = path.join(publicDir, 'debug-episode-error.png');
              const htmlPath = path.join(publicDir, 'debug-episode-error.html');

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
      message: error.message || 'An error occurred during episode scraping.',
      diagnostics: 'Diagnostics saved in public directory (debug-episode-error.png and debug-episode-error.html).'
    }, { status: 500 });
  }
}

