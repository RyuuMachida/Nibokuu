async function main() {
  const url = 'https://samehadaku.li/wp-json/custom/v1/all-schedule?perpage=20&day=tuesday';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response (first 500 chars):', text.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
