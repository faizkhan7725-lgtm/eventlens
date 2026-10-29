const fs = require('fs');
const path = require('path');
const axios = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/axios');
const tus = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/tus-js-client');

const credsPath = 'C:/Users/admin/AppData/Roaming/hostinger-mcp/credentials.json';
const domain = 'events.novusgrid.io';
const username = 'u849997931';
const zipPath = path.resolve(__dirname, '../dist/eventlens-source.zip');
const apiBase = 'https://developers.hostinger.com';

async function main() {
  console.log('====================================================');
  console.log(`🚀 Hostinger Native Next.js Deployment: ${domain}`);
  console.log('====================================================');

  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  const token = creds.access_token;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'extension;antigravity;1.4.7',
  };

  // Step 1: Set environment variables
  console.log('\n[1/4] Configuring Hostinger Node.js environment variables...');
  const envPayload = {
    env_vars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'NEXT_PUBLIC_APP_NAME', value: 'EventLens' },
      { key: 'NEXT_PUBLIC_SITE_URL', value: `https://${domain}` },
      { key: 'NEXT_PUBLIC_API_URL', value: 'http://localhost:8000/api' },
    ],
  };

  await axios.put(
    `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds/settings/env`,
    envPayload,
    { headers }
  );
  console.log('✅ Environment variables saved.');

  // Step 2: Upload source zip
  console.log('\n[2/4] Uploading source bundle to Hostinger...');
  const stats = fs.statSync(zipPath);
  console.log(`📦 Size: ${(stats.size / 1024).toFixed(1)} KB`);

  const uploadCredsRes = await axios.post(
    `${apiBase}/api/hosting/v1/files/upload-urls`,
    { username, domain },
    { headers }
  );

  const { url: uploadUrl, auth_key: authToken, rest_auth_key: authRestToken } = uploadCredsRes.data;
  const archiveName = path.basename(zipPath);
  const cleanUploadUrl = uploadUrl.replace(/\/+$/, '');
  const uploadUrlWithFile = `${cleanUploadUrl}/${encodeURIComponent(archiveName)}?override=true`;

  const requestHeaders = {
    'X-Auth': authToken,
    'X-Auth-Rest': authRestToken,
    'upload-length': stats.size.toString(),
    'upload-offset': '0',
  };

  await axios.post(uploadUrlWithFile, '', {
    headers: requestHeaders,
    timeout: 60000,
    validateStatus: (s) => s === 201 || s === 200,
  });

  await new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(zipPath);
    const upload = new tus.Upload(fileStream, {
      uploadUrl: uploadUrlWithFile,
      retryDelays: [1000, 2000, 4000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      headers: requestHeaders,
      removeFingerprintOnSuccess: true,
      uploadSize: stats.size,
      metadata: { filename: archiveName },
      onError: (err) => reject(new Error('TUS upload failed: ' + err.message)),
      onProgress: (up, tot) => {
        const pct = ((up / tot) * 100).toFixed(1);
        process.stdout.write(`\r  -> Upload progress: ${pct}%`);
      },
      onSuccess: () => {
        console.log('\n✅ Source bundle uploaded successfully!');
        resolve();
      },
    });
    upload.start();
  });

  // Step 3: Trigger Next.js build
  console.log('\n[3/4] Triggering Hostinger Next.js cloud builder...');
  const buildPayload = {
    app_type: 'next',
    node_version: 20,
    build_script: 'build',
    source_type: 'archive',
    source_options: {
      archive_path: archiveName,
    },
  };

  const buildRes = await axios.post(
    `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds`,
    buildPayload,
    { headers, validateStatus: (s) => s < 500 }
  );

  if (buildRes.status !== 200 && buildRes.status !== 201 && buildRes.status !== 202) {
    throw new Error(`Failed to trigger build: ${JSON.stringify(buildRes.data)}`);
  }

  const buildUuid = buildRes.data.uuid;
  console.log(`✅ Build started! UUID: ${buildUuid}`);

  // Step 4: Stream/monitor build logs
  console.log('\n[4/4] Monitoring build progress on Hostinger server...');
  let attempts = 0;
  const maxAttempts = 40; // ~6.5 minutes

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 10000));
    attempts++;

    try {
      const statusRes = await axios.get(
        `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds/${buildUuid}`,
        { headers }
      );

      const state = statusRes.data?.state;
      console.log(`  [Poll ${attempts}/${maxAttempts}] State: ${state}`);

      if (state === 'completed' || state === 'ready' || state === 'success') {
        console.log('\n🎉 ====================================================');
        console.log(`🎉 NEXT.JS LIVE ON HOSTINGER!`);
        console.log(`🌐 Live URL: https://${domain}`);
        console.log('🎉 ====================================================');
        return;
      }

      if (state === 'failed') {
        console.error('❌ Build failed. Fetching logs...');
        const logRes = await axios.get(
          `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds/${buildUuid}/logs`,
          { headers }
        );
        console.error('\n--- SERVER BUILD LOGS ---');
        console.error(logRes.data?.logs || 'No logs recorded');
        console.error('-------------------------\n');
        throw new Error('Hostinger server build failed');
      }
    } catch (err) {
      if (err.message.includes('build failed')) throw err;
      console.warn('  Warning while polling:', err.message);
    }
  }

  console.log('\n⚠️ Build is taking longer than expected in the background. Check Hostinger hPanel for live status.');
}

main().catch((err) => {
  console.error('\n❌ Deployment script error:', err.message);
  process.exit(1);
});
