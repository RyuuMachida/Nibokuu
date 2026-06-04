import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { logRequest } from '@/lib/logger';

interface StreamSource {
  file: string;
  type: string;
  label: string;
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

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': targetUrl
    };

    if (targetUrl.includes('krakenfiles.com')) {
      console.log(`Resolving Krakenfiles stream: ${targetUrl}`);
      
      const res = await fetch(targetUrl, { headers, next: { revalidate: 3600 } });
      if (!res.ok) {
        throw new Error(`Failed to fetch Krakenfiles page: ${res.statusText}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const streamUrl = $('video source').first().attr('src');

      if (!streamUrl) {
        throw new Error('Video stream source not found in Krakenfiles HTML.');
      }

      const latency = Date.now() - startTime;
      await logRequest(endpoint, 'GET', '200 OK', 200, latency, false);

      return NextResponse.json({
        status: 'success',
        project: 'Nibokuu API',
        provider: 'Krakenfiles',
        streamUrl,
        type: 'video/mp4'
      });
    } 
    else if (targetUrl.includes('blogger.com')) {
      console.log(`Resolving Blogger stream: ${targetUrl}`);

      const res = await fetch(targetUrl, { headers, next: { revalidate: 3600 } });
      if (!res.ok) {
        throw new Error(`Failed to fetch Blogger page: ${res.statusText}`);
      }

      const html = await res.text();
      const match = html.match(/var\s+videoSources\s*=\s*(\[[^\]]+\])/);

      if (match) {
        try {
          const sources = JSON.parse(match[1]) as StreamSource[];
          const latency = Date.now() - startTime;
          await logRequest(endpoint, 'GET', '200 OK', 200, latency, false);

          return NextResponse.json({
            status: 'success',
            project: 'Nibokuu API',
            provider: 'Blogger',
            sources
          });
        } catch (jsonErr) {
          throw new Error('Failed to parse Blogger video sources JSON.');
        }
      }

      // Fallback regex to capture any direct video link in Blogger page source
      const urlMatches = html.match(/"(https:\/\/[a-zA-Z0-9.-]+\.googlevideo\.com\/videoplayback[^"]+)"/g);
      if (urlMatches && urlMatches.length > 0) {
        const streamUrl = urlMatches[0].replace(/"/g, '');
        const latency = Date.now() - startTime;
        await logRequest(endpoint, 'GET', '200 OK', 200, latency, false);

        return NextResponse.json({
          status: 'success',
          project: 'Nibokuu API',
          provider: 'Blogger',
          streamUrl,
          type: 'video/mp4'
        });
      }

      throw new Error('Blogger video sources not found.');
    } 
    else {
      // General scraper fallback for other HTML5 video pages
      console.log(`Attempting general video resolution for: ${targetUrl}`);
      const res = await fetch(targetUrl, { headers, next: { revalidate: 3600 } });
      if (!res.ok) {
        throw new Error(`Failed to fetch page: ${res.statusText}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      
      const streamUrl = $('video source').first().attr('src') || $('video').first().attr('src');
      if (streamUrl) {
        const latency = Date.now() - startTime;
        await logRequest(endpoint, 'GET', '200 OK', 200, latency, false);

        return NextResponse.json({
          status: 'success',
          project: 'Nibokuu API',
          provider: 'Generic HTML5',
          streamUrl,
          type: $('video source').first().attr('type') || 'video/mp4'
        });
      }

      const latency = Date.now() - startTime;
      await logRequest(endpoint, 'GET', '400 Bad Request', 400, latency, false);
      return NextResponse.json({
        status: 'error',
        project: 'Nibokuu API',
        message: 'Unsupported provider or direct video stream not found.'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Stream Resolver Error:', error);

    const latency = Date.now() - startTime;
    await logRequest(endpoint, 'GET', '500 Internal Server Error', 500, latency, false);

    return NextResponse.json({
      status: 'error',
      project: 'Nibokuu API',
      message: error.message || 'An error occurred during stream link resolution.'
    }, { status: 500 });
  }
}
