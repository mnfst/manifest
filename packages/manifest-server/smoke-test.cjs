/**
 * Smoke test for @mnfst/server installed from npm tarball.
 * Verifies that static files are served and the health API responds.
 *
 * Usage: node smoke-test.cjs
 */
const http = require('http');

function fetch(url) {
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
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Server not ready after ${retries * delay}ms`);
}

(async () => {
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET || 'smoke-test-secret-at-least-32-chars!!';

  const { start } = require('@mnfst/server');
  await start({ port: 2099, host: '127.0.0.1' });

  await waitForServer('http://127.0.0.1:2099/api/v1/health');

  // Check static files
  const html = await fetch('http://127.0.0.1:2099/');
  if (html.status !== 200 || !html.body.includes('<html')) {
    console.error('FAIL: / did not return HTML', html.status);
    process.exit(1);
  }
  console.log('PASS: Static files served');

  // Check health API
  const health = await fetch('http://127.0.0.1:2099/api/v1/health');
  if (health.status !== 200) {
    console.error('FAIL: /api/v1/health returned', health.status);
    process.exit(1);
  }
  console.log('PASS: Health endpoint OK');

  process.exit(0);
})();
