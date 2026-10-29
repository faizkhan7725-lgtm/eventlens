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
header('Content-Type: text/plain');
$logPaths = [
  '/home/u849997931/domains/novusgrid.io/events/hbuilds/current/nodejs/stderr.log',
  '/home/u849997931/domains/novusgrid.io/events/hbuilds/current/nodejs/console.log',
  '/home/u849997931/domains/novusgrid.io/events/hbuilds/logs'
];
foreach ($logPaths as $p) {
  echo "=== $p ===\n";
  if (is_file($p)) {
    echo file_get_contents($p) . "\n";
  } elseif (is_dir($p)) {
    print_r(scandir($p));
  } else {
    echo "NOT FOUND\n";
  }
}
`;
  await uploadFile('read_error_logs.php', phpCode);
  const res = await fetch('https://events.novusgrid.io/read_error_logs.php');
  console.log(await res.text());
}

main().catch(console.error);
