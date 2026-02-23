/**
 * Smoke test for @mnfst/server installed from npm tarball.
 * Verifies that static files are served and the health API responds.
 * This file is NOT published to npm (excluded via package.json "files").
 *
 * Usage: node smoke-test.cjs
 */
const http = require('http');

const PORT = 2099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Kill the process if the test hangs for more than 2 minutes
setTimeout(() => {
  console.error('FAIL: Smoke test timed out after 120s');
  process.exit(1);
}, 120_000).unref();

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

async function waitForServer(url, retries = 60, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const { status } = await httpGet(url);
      if (status >= 200 && status < 500) return;
    } catch {
      // Connection refused — server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error(`Server not ready after ${retries * delay}ms`);
}

(async () => {
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET || 'smoke-test-secret-at-least-32-chars!!';

  const { start } = require('@mnfst/server');
  const app = await start({ port: PORT, host: '127.0.0.1', dbPath: ':memory:' });

  await waitForServer(`${BASE_URL}/api/v1/health`);

  // Check static files
  const html = await httpGet(`${BASE_URL}/`);
  if (html.status !== 200 || !html.body.includes('<html')) {
    console.error('FAIL: / did not return HTML', html.status);
    process.exit(1);
  }
  console.log('PASS: Static files served');

  // Check health API returns valid JSON
  const health = await httpGet(`${BASE_URL}/api/v1/health`);
  if (health.status !== 200) {
    console.error('FAIL: /api/v1/health returned', health.status);
    process.exit(1);
  }
  const healthData = JSON.parse(health.body);
  if (healthData.status !== 'healthy') {
    console.error('FAIL: health status is', healthData.status);
    process.exit(1);
  }
  console.log('PASS: Health endpoint OK');

  await app.close();
  console.log('\nAll smoke tests passed (2/2)');
  process.exit(0);
})().catch((err) => {
  console.error('FAIL: Smoke test crashed:', err);
  process.exit(1);
});
