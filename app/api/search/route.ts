import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDomain, sanitizeSamehadakuUrl } from '@/lib/resolver';
import { scrapeHtml } from '@/lib/browser';
import { getFromCache, setToCache, coalesceScrape } from '@/lib/cache';
import { logRequest } from '@/lib/logger';

interface SearchResult {
  title: string;
  link: string | undefined;
  image: string | undefined;
  type: string;
  score: string;
  episodes_api_link?: string;
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

  const activeDomain = await getFromCache<string>('resolved_samehadaku_domain') || 'https://v2.samehadaku.how/';

  // 1. Check Cache first
  const cacheKey = `search:${query.trim().toLowerCase()}`;
  if (!bypassCache || !isAuth) {
    const cachedData = await getFromCache<any>(cacheKey);
    if (cachedData) {
      console.log(`Serving search query "${query}" from cache.`);
      
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
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=59',
        },
      });
    }
  }

  try {
    const successResponse = await coalesceScrape(cacheKey, async () => {
      const searchUrl = `${activeDomain}?s=${encodeURIComponent(query)}`;
      console.log(`Searching for "${query}" at: ${searchUrl}`);
      
      const { html: htmlData } = await scrapeHtml(searchUrl, '.animepost, .bsx, .page-title, .notfound');

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
            const cleanLink = sanitizeSamehadakuUrl(link, activeDomain);
            const cleanImage = sanitizeSamehadakuUrl(image, activeDomain);
            searchResults.push({
              title: cleanTitle,
              link: cleanLink,
              image: cleanImage,
              type,
              score,
              episodes_api_link: `/api/episodes?url=${encodeURIComponent(cleanLink || '')}`
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

