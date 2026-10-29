const fs = require('fs');
const path = require('path');
const axios = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/axios');
const tus = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/tus-js-client');

const credsPath = 'C:/Users/admin/AppData/Roaming/hostinger-mcp/credentials.json';
const domain = 'events.novusgrid.io';
const username = 'u849997931';
const zipPath = path.resolve(__dirname, '../dist/eventlens-hostinger.zip');
const apiBase = 'https://developers.hostinger.com';

async function main() {
  console.log('====================================================');
  console.log(`🚀 Starting Hostinger Direct Deployment for ${domain}`);
  console.log('====================================================');

  if (!fs.existsSync(credsPath)) {
    throw new Error('Hostinger credentials file not found: ' + credsPath);
  }
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  const token = creds.access_token;

  if (!fs.existsSync(zipPath)) {
    throw new Error('Deployable zip not found at: ' + zipPath);
  }
  const stats = fs.statSync(zipPath);
  console.log(`📦 Bundle archive: ${zipPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);

  // Step 1: Generate upload URL
  console.log('\n[1/4] Requesting secure TUS upload credentials...');
  const uploadCredsRes = await axios.post(
    `${apiBase}/api/hosting/v1/files/upload-urls`,
    { username, domain },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'extension;antigravity;1.4.7',
      },
    }
  );

  const { url: uploadUrl, auth_key: authToken, rest_auth_key: authRestToken } = uploadCredsRes.data;
  console.log('✅ Upload endpoint acquired:', uploadUrl);

  // Step 2: Upload archive via TUS
  console.log('\n[2/4] Uploading archive to Hostinger storage...');
  const archiveName = path.basename(zipPath);
  const cleanUploadUrl = uploadUrl.replace(/\/+$/, '');
  const uploadUrlWithFile = `${cleanUploadUrl}/${encodeURIComponent(archiveName)}?override=true`;

  const requestHeaders = {
    'X-Auth': authToken,
    'X-Auth-Rest': authRestToken,
    'upload-length': stats.size.toString(),
    'upload-offset': '0',
  };

  // Pre-upload POST
  console.log('  -> Initializing TUS transfer session...');
  await axios.post(uploadUrlWithFile, '', {
    headers: requestHeaders,
    timeout: 60000,
    validateStatus: (s) => s === 201 || s === 200,
  });

  // TUS upload
  console.log('  -> Streaming bytes...');
  await new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(zipPath);
    const upload = new tus.Upload(fileStream, {
      uploadUrl: uploadUrlWithFile,
      retryDelays: [1000, 2000, 4000, 8000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      chunkSize: 5 * 1024 * 1024,
      headers: requestHeaders,
      removeFingerprintOnSuccess: true,
      uploadSize: stats.size,
      metadata: { filename: archiveName },
      onError: (err) => reject(new Error('TUS upload failed: ' + err.message)),
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
        process.stdout.write(`\r  -> Progress: ${pct}% (${bytesUploaded} / ${bytesTotal} bytes)`);
      },
      onSuccess: () => {
        console.log('\n✅ Archive uploaded successfully!');
        resolve();
      },
    });
    upload.start();
  });

  // Step 3: Trigger Node.js build
  console.log('\n[3/4] Triggering Node.js build on Hostinger server...');
  const buildPayload = {
    node_version: 20,
    app_type: 'express',
    entry_file: 'server.js',
    package_manager: 'npm',
    source_type: 'archive',
    source_options: {
      archive_path: archiveName,
    },
  };

  const buildRes = await axios.post(
    `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds`,
    buildPayload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'extension;antigravity;1.4.7',
      },
      validateStatus: (s) => s < 500,
    }
  );

  if (buildRes.status !== 200 && buildRes.status !== 201 && buildRes.status !== 202) {
    console.error('Build API returned:', buildRes.status, buildRes.data);
    throw new Error(`Failed to trigger build: ${JSON.stringify(buildRes.data)}`);
  }

  const build = buildRes.data;
  console.log(`✅ Build dispatched! UUID: ${build.uuid || 'N/A'}, Initial State: ${build.state || 'running'}`);

  // Step 4: Poll build status
  console.log('\n[4/4] Monitoring build execution...');
  const buildUuid = build.uuid;
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 10000)); // wait 10s
    attempts++;

    try {
      const statusRes = await axios.get(
        `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds?per_page=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'extension;antigravity;1.4.7',
          },
        }
      );

      const latestBuild = statusRes.data?.data?.[0];
      const state = latestBuild?.state || 'unknown';
      console.log(`  [Poll ${attempts}/${maxAttempts}] Build status: ${state}`);

      if (state === 'completed' || state === 'success' || state === 'ready') {
        console.log('\n🎉 ====================================================');
        console.log(`🎉 DEPLOYMENT SUCCEEDED!`);
        console.log(`🌐 Live URL: https://${domain}`);
        console.log('🎉 ====================================================');
        return;
      }

      if (state === 'failed') {
        console.error('❌ Build failed on server:', latestBuild);
        throw new Error('Hostinger server build failed');
      }
    } catch (err) {
      console.warn('  Warning while polling:', err.message);
    }
  }

  console.log(`\n⚠️ Polling timed out, but build is running in the background on Hostinger! Check hPanel for final status.`);
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
