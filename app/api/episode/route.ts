import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { launchBrowser } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';
import { sanitizeSamehadakuUrl } from '@/lib/resolver';

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

  const activeDomain = await getFromCache<string>('resolved_samehadaku_domain') || 'https://v2.samehadaku.how/';
  // Sanitize input targetUrl
  const sanitizedTargetUrl = sanitizeSamehadakuUrl(targetUrl, activeDomain) || targetUrl;

  // 1. Check Cache first
  const cacheKey = `episode:${sanitizedTargetUrl.trim().toLowerCase()}`;
  if (!bypassCache || !isAuth) {
    const cachedData = await getFromCache<any>(cacheKey);
    if (cachedData) {
      console.log(`Serving episode details for "${sanitizedTargetUrl}" from cache.`);
      
      // Sanitize cached URLs on the fly to reflect any domain changes instantly
      if (cachedData.parentAnimeUrl) {
        cachedData.parentAnimeUrl = sanitizeSamehadakuUrl(cachedData.parentAnimeUrl, activeDomain);
      }
      if (cachedData.episodes && Array.isArray(cachedData.episodes)) {
        cachedData.episodes = cachedData.episodes.map((ep: any) => ({
          ...ep,
          link: sanitizeSamehadakuUrl(ep.link, activeDomain)
        }));
      }
      if (cachedData.mirrors && Array.isArray(cachedData.mirrors)) {
        cachedData.mirrors = cachedData.mirrors.map((m: any) => ({
          ...m,
          link: m.link ? sanitizeSamehadakuUrl(m.link, activeDomain) : undefined
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

        const isAnimeDetail = sanitizedTargetUrl.includes('/anime/');

        console.log(`Navigating to target page: ${sanitizedTargetUrl}`);
        await page.goto(sanitizedTargetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        if (isAnimeDetail) {
          console.log('Waiting for episode list...');
          await page.waitForSelector('.eplister, .listeps', { timeout: 15000 }).catch((err) => {
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

        // If this is the parent anime detail page, also extract and cache the metadata
        if (isAnimeDetail) {
          const rating = $('.rating strong, .score, [itemprop="ratingValue"]').text().trim();
          const synopsis = $('.entry-content, [itemprop="description"], .desc, .sinopsis').first().text().trim();
          const image = $('.thumb img, .poster img').first().attr('src') || $('.thumb img, .poster img').first().attr('data-src');
          
          const genres: string[] = [];
          $('.genre-info a').each((_, el) => {
            const gText = $(el).text().trim();
            if (gText) genres.push(gText);
          });

          const metadataInfo: Record<string, string | string[]> = {};
          $('.spe span, .info-content span, .info_anime span').each((_, el) => {
            const rawKey = $(el).find('b').text().replace(':', '').trim();
            if (rawKey) {
              const clonedEl = $(el).clone();
              clonedEl.find('b').remove();
              const links: string[] = [];
              clonedEl.find('a').each((_, aEl) => {
                const aText = $(aEl).text().trim();
                if (aText) links.push(aText);
              });
              const cleanKey = rawKey.toLowerCase();
              if (links.length > 0) {
                metadataInfo[cleanKey] = links;
              } else {
                metadataInfo[cleanKey] = clonedEl.text().replace(/^\s*:\s*/, '').trim();
              }
            }
          });

          const detailCacheKey = `anime-detail:${targetUrl.trim().toLowerCase()}`;
          const detailData = {
            status: 'success',
            project: 'Nibokuu API',
            title,
            rating,
            synopsis,
            image,
            genres,
            metadata: metadataInfo
          };
          // Cache anime detail for 30 days (2592000 seconds)
          await setToCache(detailCacheKey, detailData, 2592000);
          console.log(`[Episode Route] Auto-populated anime-detail cache for: ${targetUrl}`);
        }

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

        // Extract episodes list from .eplister / .listeps
        const episodes: { title: string; link: string | undefined; episode: string }[] = [];
        $('.eplister li, .listeps li').each((_, el) => {
          const anchor = $(el).find('a');
          const epTitle = anchor.find('.epl-title').text().trim() || $(el).find('.epsleft .lchx a').text().trim() || anchor.text().trim();
          const link = anchor.attr('href');
          const epNum = anchor.find('.epl-num').text().trim() || $(el).find('.epsright .eps a').text().trim() || $(el).find('.epsright .eps').text().trim();
          if (link) {
            episodes.push({
              title: epTitle || `Episode ${epNum}`,
              link: sanitizeSamehadakuUrl(link, activeDomain) || link,
              episode: epNum
            });
          }
        });
        // Reverse to display episodes from 1 to max episode
        episodes.reverse();

        // Try to find parent anime URL if this is a single episode page
        let parentAnimeUrl = '';
        if (!isAnimeDetail) {
          const parentAnimeSelectors = [
            '.breadcrumbs a[href*="/anime/"]',
            '.breadcrumb a[href*="/anime/"]',
            'a[href*="/anime/"]:contains("Semua Episode")',
            '.entbar a[href*="/anime/"]',
            '.c-breadcrumb a[href*="/anime/"]',
          ];
          for (const sel of parentAnimeSelectors) {
            const href = $(sel).first().attr('href');
            if (href && !href.includes('/daftar-anime-2/')) {
              parentAnimeUrl = href;
              break;
            }
          }
          if (!parentAnimeUrl) {
            $('a[href*="/anime/"]').each((_, el) => {
              const href = $(el).attr('href');
              if (href && !href.includes('/daftar-anime-2/') && !href.includes('/genres/')) {
                parentAnimeUrl = href;
                return false; // break loop
              }
            });
          }
        }

        if (parentAnimeUrl) {
          parentAnimeUrl = sanitizeSamehadakuUrl(parentAnimeUrl, activeDomain) || parentAnimeUrl;
        }

        console.log(`Successfully scraped: "${title}" (isAnimeDetail: ${isAnimeDetail}, episodes: ${episodes.length}, parentAnimeUrl: ${parentAnimeUrl || 'none'})`);

        const responseData = {
          status: 'success',
          project: 'Nibokuu API',
          title,
          isAnimeDetail,
          iframeUrl: iframeUrl || undefined,
          mirrors,
          episodes,
          parentAnimeUrl: parentAnimeUrl || undefined
        };

        // Episode details (isAnimeDetail = false) are static, so cache for 1 year (31536000 seconds)
        // Anime details (isAnimeDetail = true) are cached for 30 days (2592000 seconds)
        const ttl = isAnimeDetail ? 2592000 : 31536000;
        await setToCache(cacheKey, responseData, ttl);

        // Trigger background updates for parent anime asynchronously if needed
        if (parentAnimeUrl) {
          const origin = request.nextUrl.origin;
          const secret = process.env.ADMIN_SECRET_KEY || '';
          const authHeader = secret ? `Bearer ${secret}` : '';
          const parentCacheKey = `episode:${parentAnimeUrl.trim().toLowerCase()}`;

          // Avoid blocking response, do cache check and update in background
          (async () => {
            try {
              const cachedParent = await getFromCache<any>(parentCacheKey);
              let needsUpdate = true;

              if (cachedParent && Array.isArray(cachedParent.episodes)) {
                // Check if the current episode link is already listed in the parent episodes cache
                const normalizedTarget = targetUrl.trim().toLowerCase();
                const isEpisodeListed = cachedParent.episodes.some((ep: any) => 
                  ep.link && ep.link.trim().toLowerCase() === normalizedTarget
                );

                if (isEpisodeListed) {
                  console.log(`[Cache Optimizer] Parent anime cache for ${parentAnimeUrl} is already up to date (lists current episode). Skipping remote browser launch.`);
                  needsUpdate = false;
                }
              }

              if (needsUpdate) {
                console.log(`[Cache Optimizer] Parent anime cache for ${parentAnimeUrl} is missing or outdated. Triggering single background sync...`);
                // Fetch `/api/episode` for the parent anime page with `bypass_cache=true`.
                // This single scrape will populate BOTH `episode:${parentAnimeUrl}` and `anime-detail:${parentAnimeUrl}`.
                fetch(`${origin}/api/episode?url=${encodeURIComponent(parentAnimeUrl)}&bypass_cache=true`, {
                  headers: authHeader ? { 'Authorization': authHeader } : {},
                  signal: AbortSignal.timeout(25000)
                }).catch((err) => {
                  console.warn(`[Cache Optimizer] Background parent sync failed:`, err.message);
                });
              }
            } catch (err: any) {
              console.warn('[Cache Optimizer] Error checking parent cache:', err.message);
            }
          })();
        }

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

