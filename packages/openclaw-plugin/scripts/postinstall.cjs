/**
 * postinstall check — surfaces better-sqlite3 native module failures at
 * install time instead of letting them silently break the server at runtime.
 *
 * This runs after `npm install manifest` (or `openclaw plugins install manifest`).
 * It attempts to load better-sqlite3 via @mnfst/server's dependency tree.
 * On failure it prints a visible warning with remediation steps.
 */
'use strict';

try {
  require('better-sqlite3');
} catch (_err) {
  const isCI = !!(process.env.CI || process.env.CONTINUOUS_INTEGRATION);
  if (isCI) {
    // In CI, skip the warning — native compilation may legitimately differ
    process.exit(0);
  }

  const msg = _err instanceof Error ? _err.message : String(_err);
  const isMac = process.platform === 'darwin';

  console.warn('');
  console.warn('  ╔══════════════════════════════════════════════════════════════╗');
  console.warn('  ║  ⚠  Manifest: better-sqlite3 native module not available   ║');
  console.warn('  ╚══════════════════════════════════════════════════════════════╝');
  console.warn('');
  console.warn('  The local dashboard requires a compiled SQLite native addon.');
  console.warn('  It failed to load with:');
  console.warn('    ' + msg);
  console.warn('');
  if (isMac) {
    console.warn('  On macOS, install Xcode Command Line Tools first:');
    console.warn('    xcode-select --install');
    console.warn('');
  }
  console.warn('  Then rebuild the native module:');
  console.warn('    npm rebuild better-sqlite3');
  console.warn('');
  console.warn('  Or reinstall the plugin:');
  console.warn('    openclaw plugins install manifest');
  console.warn('');

  // Exit 0 so npm install doesn't fail — this is a warning, not a blocker.
  // The runtime pre-flight check in @mnfst/server will still catch this.
}
