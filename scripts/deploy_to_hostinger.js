const fs = require('fs');
const path = require('path');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const axios = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/axios');
const tus = require('C:/Users/admin/AppData/Local/npm-cache/_npx/1a1117b4c4b191d0/node_modules/tus-js-client');

const credsPath = 'C:/Users/admin/AppData/Roaming/hostinger-mcp/credentials.json';
const domain = 'events.novusgrid.io';
const username = 'u849997931';
const zipPath = path.resolve(__dirname, '../dist/eventlens-express-deploy.zip');
const apiBase = 'https://developers.hostinger.com';

async function main() {
  console.log('====================================================');
  console.log(`🚀 Starting EventLens Hostinger Deployment (${domain})`);
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

  // Step 1: Request TUS upload credentials
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

  // Step 3: Trigger Node.js build with Express app type
  console.log('\n[3/4] Triggering Express Node.js build on Hostinger server...');
  const buildPayload = {
    node_version: 20,
    app_type: 'express',
    root_directory: null,
    output_directory: null,
    build_script: null,
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
  const maxAttempts = 40;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 8000)); // wait 8s
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
      console.log(`  [Poll ${attempts}/${maxAttempts}] Build state: ${state}`);

      if (state === 'completed' || state === 'success' || state === 'ready') {
        console.log('\n🎉 ====================================================');
        console.log(`🎉 HOSTINGER DEPLOYMENT COMPLETED!`);
        console.log(`🌐 Live URL: https://${domain}`);
        console.log('🎉 ====================================================');

        // Test live site
        console.log('\nVerifying live website...');
        const testRes = await fetch(`https://${domain}`, { cache: 'no-store' });
        console.log(`HTTP Status: ${testRes.status}`);
        const text = await testRes.text();
        console.log(`HTML Preview:\n${text.slice(0, 400)}`);
        return;
      }

      if (state === 'failed') {
        console.error('❌ Build failed on server!');
        // Fetch logs
        try {
          const logsRes = await axios.get(
            `${apiBase}/api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds/${latestBuild.uuid}/logs`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'extension;antigravity;1.4.7',
              },
            }
          );
          console.error('Build logs:\n', logsRes.data?.logs);
        } catch (lErr) {
          console.error('Failed to get logs:', lErr.message);
        }
        throw new Error('Hostinger server build failed');
      }
    } catch (err) {
      if (err.message.includes('server build failed')) throw err;
      console.warn('  Warning while polling:', err.message);
    }
  }

  console.log(`\n⚠️ Polling timed out. Check hPanel for build status.`);
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
