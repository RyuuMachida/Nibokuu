import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function main() {
  const html = fs.readFileSync('scratch/one-piece-detail.html', 'utf8');
  const $ = cheerio.load(html);
  
  console.log('Searching for elements that might contain episode lists...');
  
  // Find all links on the page that point to an episode page
  // Episode links usually look like: samehadaku.li/one-piece-episode-xxx/
  // Or look at the text of the link
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (href.includes('episode') || text.includes('Episode')) {
      // Find its parents classes
      const parentClasses = $(el).parents().map((_, p) => {
        const id = $(p).attr('id') ? '#' + $(p).attr('id') : '';
        const cls = $(p).attr('class') ? '.' + $(p).attr('class').split(' ').join('.') : '';
        return p.tagName + id + cls;
      }).get().slice(0, 4).join(' < ');
      
      console.log(`Link: "${text}" -> ${href} | Parents: ${parentClasses}`);
    }
  });
}
main();
