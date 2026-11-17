// test/health.test.js
// Automated tests using the Node.js built-in test runner (no external deps).
// Spawns the real server on its own port, waits for it, then checks responses.

'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const serverPath = path.join(__dirname, '..', 'server.js');

// The spawned server process (module scope so the after hook can stop it).
let server;

// Keep polling the URL until the server answers, then return.
// Throws an error if the server never becomes ready.
async function waitForServer(url, retries = 30, delayMs = 200) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not up yet — ignore and retry after a short delay.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

// Before all tests: start the server on our test port and wait for it.
before(async () => {
  server = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });
  await waitForServer(`${BASE}/health`);
});

// After all tests: shut the spawned server down.
after(() => {
  if (server && !server.killed) server.kill();
});

// (a) The /health endpoint must return 200 and the expected JSON body.
test('GET /health returns 200 with { status: "ok" }', async () => {
  const res = await fetch(`${BASE}/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body, { status: 'ok' });
});

// (b) The homepage must load and mention the expected title text.
test('GET / returns the landing page mentioning Kubernetes', async () => {
  const res = await fetch(`${BASE}/`);
  assert.strictEqual(res.status, 200);
  const body = await res.text();
  assert.match(body, /Node\.js Frontend Running on Kubernetes/);
});
