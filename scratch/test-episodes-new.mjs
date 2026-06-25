async function main() {
  const url = 'http://localhost:3000/api/episodes?url=https://samehadaku.li/anime/rezero-kara-hajimeru-isekai-seikatsu-4th-season/';
  console.log('Testing endpoint:', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response (sample 3 episodes):', {
      ...json,
      episodes: json.episodes ? json.episodes.slice(0, 3) : []
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}
main();
