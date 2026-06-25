async function main() {
  const dbUrl = 'https://nibokuu-default-rtdb.asia-southeast1.firebasedatabase.app/';
  const secret = '0QOUbFaphVadJzp5WlLh5HnxBIq1ZJP0uEHCmJXG';
  
  const url = `${dbUrl}nibokuu/cache.json?auth=${secret}`;
  console.log('Purging entire Firebase Cache at:', url);
  try {
    const res = await fetch(url, {
      method: 'DELETE'
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response:', json);
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
