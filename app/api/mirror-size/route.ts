import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ status: 'error', message: 'Parameter "url" is required.' }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 86400 } // Cache size response for 24 hours
    });

    if (!res.ok) {
      return NextResponse.json({ status: 'success', size: 'Tautan mirror tidak dapat diakses' });
    }

    const html = await res.text();
    let size = '';

    if (targetUrl.includes('krakenfiles.com')) {
      const $ = cheerio.load(html);
      // Look for the General file information table
      $('.nk-iv-wg4-overview li').each((_, el) => {
        const label = $(el).find('.sub-text').text().trim().toLowerCase();
        if (label.includes('file size') || label.includes('size')) {
          size = $(el).find('.lead-text').text().trim();
        }
      });
      // Fallback regex
      if (!size) {
        const match = html.match(/File size<\/div>\s*<div[^>]*>([^<]+)/i) || 
                      html.match(/(?:file\s*size|size)[^<]*:[^<]*([\d.]+\s*(?:MB|GB|KB))/i);
        if (match) size = match[1].trim();
      }
    } 
    else if (targetUrl.includes('acefile.co')) {
      const match = html.match(/Size\s*:\s*([\d.]+\s*(?:MB|GB|KB))/i) || 
                    html.match(/Size<\/td>\s*<td>\s*:\s*([^<]+)/i);
      if (match) {
        size = match[1].trim();
      } else {
        const $ = cheerio.load(html);
        size = $('.size').text().trim() || $('td:contains("Size")').next().text().replace(':', '').trim();
      }
    }
    else if (targetUrl.includes('mediafire.com')) {
      const $ = cheerio.load(html);
      size = $('.file-info .file-size').text().trim() || 
             $('.dl-info .file-size').text().trim() || 
             $('span:contains("MB")').text().trim() || 
             $('span:contains("GB")').text().trim();
      if (!size) {
        const match = html.match(/([\d.]+\s*(?:MB|GB|KB))\s*<\/span>/i);
        if (match) size = match[1].trim();
      }
    }

    // Clean up size string
    size = size.replace(/\s+/g, ' ').trim();

    return NextResponse.json({
      status: 'success',
      size: size || 'Tidak terdeteksi'
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err.message || 'Failed to fetch size'
    });
  }
}
