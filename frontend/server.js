const express = require('express');
const next = require('next');
const path = require('path');

const port = parseInt(process.env.PORT, 10) || 3000;
const app = express();

app.set('trust proxy', 1);

const nextApp = next({ dev: false, dir: __dirname });
const handle = nextApp.getRequestHandler();

let nextReady = false;
nextApp.prepare()
  .then(() => {
    nextReady = true;
    console.log('Next.js is fully prepared and ready to serve!');
  })
  .catch((err) => {
    console.error('Next.js prepare error:', err);
  });

app.use((req, res) => {
  if (!nextReady) {
    res.setHeader('Retry-After', '2');
    return res.status(503).send('<html><head><meta http-equiv="refresh" content="2"></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>EventLens is initializing...</h2><p>Please wait a moment.</p></body></html>');
  }
  return handle(req, res);
});

// Satisfy LiteSpeed LSNODE_SOCKET immediately
const server = app.listen(port, () => {
  console.log(`EventLens server listening on port ${port}`);
});
