const fs = require('fs');
const axios = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/axios');
const creds = JSON.parse(fs.readFileSync('C:/Users/admin/AppData/Roaming/hostinger-mcp/credentials.json', 'utf8'));
const token = creds.access_token;
const apiBase = 'https://developers.hostinger.com';

async function uploadFile(fileName, content) {
  const uploadCredsRes = await axios.post(
    apiBase + '/api/hosting/v1/files/upload-urls',
    { username: 'u849997931', domain: 'events.novusgrid.io' },
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const { url, auth_key, rest_auth_key } = uploadCredsRes.data;
  const cleanUrl = url.replace(/\/+$/, '') + '/' + encodeURIComponent(fileName) + '?override=true';
  const buf = Buffer.from(content);

  await axios.post(cleanUrl, '', {
    headers: {
      'X-Auth': auth_key,
      'X-Auth-Rest': rest_auth_key,
      'upload-length': buf.length.toString(),
      'upload-offset': '0'
    }
  });

  await axios.patch(cleanUrl, buf, {
    headers: {
      'X-Auth': auth_key,
      'X-Auth-Rest': rest_auth_key,
      'Content-Type': 'application/offset+octet-stream',
      'upload-offset': '0'
    }
  });
}

async function main() {
  const phpCode = `<?php
header('Content-Type: application/json');

// Step 1: Remove default.php if present
if (file_exists(__DIR__ . '/default.php')) {
  rename(__DIR__ . '/default.php', __DIR__ . '/default.php.bak');
}

// Step 2: Create simple server.js
$serverJs = <<<'JS'
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>🚀 Hello from EventLens Node.js on Hostinger LiteSpeed Passenger!</h1><p>Status: Active and Running!</p>');
});
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('EventLens test server running on port ' + port);
});
JS;
file_put_contents(__DIR__ . '/server.js', $serverJs);

// Step 3: Create .htaccess
$htaccess = <<<'HTACCESS'
PassengerAppRoot /home/u849997931/domains/novusgrid.io/public_html/events
PassengerAppType node
PassengerNodejs /opt/alt/alt-nodejs20/root/bin/node
PassengerStartupFile server.js
PassengerBaseURI /
PassengerRestartDir /home/u849997931/domains/novusgrid.io/public_html/events/tmp
SetEnv NODE_ENV production
SetEnv PORT 3000
HTACCESS;
file_put_contents(__DIR__ . '/.htaccess', $htaccess);

// Step 4: Create tmp/restart.txt to restart passenger
if (!is_dir(__DIR__ . '/tmp')) {
  mkdir(__DIR__ . '/tmp', 0755, true);
}
file_put_contents(__DIR__ . '/tmp/restart.txt', time());

echo json_encode([
  'status' => 'setup_complete',
  'serverJs' => file_exists(__DIR__ . '/server.js'),
  'htaccess' => file_exists(__DIR__ . '/.htaccess'),
  'restart' => file_exists(__DIR__ . '/tmp/restart.txt')
], JSON_PRETTY_PRINT);
`;
  await uploadFile('setup_test_passenger.php', phpCode);
  console.log('Uploaded setup script. Executing...');
  const res = await fetch('https://events.novusgrid.io/setup_test_passenger.php');
  console.log('Setup output:', await res.text());

  // Wait 3 seconds for Passenger to initialize
  await new Promise(r => setTimeout(r, 3000));

  console.log('\nTesting https://events.novusgrid.io/ ...');
  const testRes = await fetch('https://events.novusgrid.io/', { cache: 'no-store' });
  console.log('HTTP Status:', testRes.status);
  console.log('Headers:', Object.fromEntries(testRes.headers.entries()));
  console.log('Body:', await testRes.text());
}

main().catch(console.error);
