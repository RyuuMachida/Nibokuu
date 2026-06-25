import * as cheerio from 'cheerio';

async function main() {
  const url = 'https://samehadaku.li/';
  console.log('Fetching homepage:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log('Searching for schedule links...');
    $('a').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      if (text.toLowerCase().includes('jadwal') || href?.toLowerCase().includes('jadwal') || text.toLowerCase().includes('schedule') || href?.toLowerCase().includes('schedule')) {
        console.log(`Found link: "${text}" -> ${href}`);
      }
    });
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
