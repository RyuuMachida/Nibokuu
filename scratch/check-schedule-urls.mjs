async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`URL: ${url} -> Status: ${res.status}`);
    if (res.status === 200) {
      const html = await res.text();
      if (!html.includes('Page not found') && !html.includes('404')) {
        console.log(`  => SUCCESS! Length: ${html.length}`);
      }
    }
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
  }
}

async function main() {
  const urls = [
    'https://samehadaku.li/jadwal-rilis/',
    'https://samehadaku.li/jadwal/',
    'https://samehadaku.li/schedule/',
    'https://samehadaku.li/release-schedule/',
    'https://samehadaku.li/jadwal-anime/'
  ];
  for (const url of urls) {
    await checkUrl(url);
  }
}
main();
