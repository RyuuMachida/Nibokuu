import * as cheerio from 'cheerio';

async function main() {
  const url = 'https://samehadaku.li/';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log('--- MENU-MENU ---');
    $('#menu-menu a').each((_, el) => {
      console.log(`- "${$(el).text().trim()}" -> ${$(el).attr('href')}`);
    });
    
    console.log('--- HEADER NAV ---');
    $('.header a, nav a, .navigation a').each((_, el) => {
      console.log(`- "${$(el).text().trim()}" -> ${$(el).attr('href')}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
