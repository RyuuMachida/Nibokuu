async function main() {
  const url = 'http://localhost:3000/api/search?q=rezero';
  console.log('Testing search endpoint:', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
main();
