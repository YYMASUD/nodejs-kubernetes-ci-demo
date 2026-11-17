// server.js
// A tiny Express server for the Node.js + Kubernetes CI demo.
//  - Serves the static frontend from the public/ folder
//  - Exposes a /health endpoint that Kubernetes and CI checks can ping
//  - Can be imported by tests without starting a real listener

'use strict';

const express = require('express');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static assets (HTML, CSS, images) from the public folder.
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint — returns a simple JSON status.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Catch-all handler: any unknown route gets a JSON 404 response.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Only start listening when this file is run directly (not when imported by tests).
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

module.exports = app;
