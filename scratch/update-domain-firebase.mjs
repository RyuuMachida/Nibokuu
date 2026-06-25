async function main() {
  const dbUrl = 'https://nibokuu-default-rtdb.asia-southeast1.firebasedatabase.app/';
  const secret = '0QOUbFaphVadJzp5WlLh5HnxBIq1ZJP0uEHCmJXG';
  const key = 'resolved_samehadaku_domain';
  const val = 'https://samehadaku.li/';
  
  const entry = {
    data: val,
    expiry: Date.now() + 86400 * 1000 // 24 hours
  };
  
  const url = `${dbUrl}nibokuu/cache/${key}.json?auth=${secret}`;
  console.log('Updating Firebase Cache at:', url);
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Response:', json);
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
