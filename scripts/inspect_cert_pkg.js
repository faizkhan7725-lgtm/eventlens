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
$certNodejs = '/home/u849997931/domains/novusgrid.io/certificate/hbuilds/current/nodejs';
$files = file_exists($certNodejs) ? scandir($certNodejs) : 'NOT_FOUND';
$pkg = file_exists("$certNodejs/package.json") ? json_decode(file_get_contents("$certNodejs/package.json"), true) : null;

echo json_encode([
  'files' => $files,
  'packageJson' => $pkg
], JSON_PRETTY_PRINT);
`;
  await uploadFile('inspect_cert_pkg.php', phpCode);
  const res = await fetch('https://events.novusgrid.io/inspect_cert_pkg.php');
  console.log(await res.text());
}

main().catch(console.error);
