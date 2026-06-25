import * as cheerio from 'cheerio';

async function main() {
  const url = 'https://samehadaku.li/anime/rezero-kara-hajimeru-isekai-seikatsu-4th-season/';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log('--- ALL LINKS ---');
    $('a').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      console.log(`- "${text}" -> ${href}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
