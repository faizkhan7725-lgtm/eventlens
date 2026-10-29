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
$zipPath = __DIR__ . '/eventlens-hostinger.zip';
if (!file_exists($zipPath)) {
  echo json_encode(['error' => 'zip not found']);
  exit;
}

$zip = new ZipArchive();
if ($zip->open($zipPath) === TRUE) {
  $numFiles = $zip->numFiles;
  $entries = [];
  for ($i = 0; $i < min(20, $numFiles); $i++) {
    $entries[] = $zip->getNameIndex($i);
  }
  $zip->close();
  echo json_encode([
    'zipSize' => filesize($zipPath),
    'numFiles' => $numFiles,
    'first20' => $entries
  ], JSON_PRETTY_PRINT);
} else {
  echo json_encode(['error' => 'failed to open zip']);
}
`;
  await uploadFile('check_zip.php', phpCode);
  const res = await fetch('https://events.novusgrid.io/check_zip.php');
  console.log(await res.text());
}

main().catch(console.error);
