const { cpSync, copyFileSync, existsSync } = require('fs');
const { join } = require('path');

const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
const frontendTarget = join(__dirname, '..', 'public');

if (existsSync(frontendDist)) {
  cpSync(frontendDist, frontendTarget, { recursive: true });
  console.log('Copied frontend assets to public/');
} else {
  console.warn('Frontend dist not found — skipping asset copy. Build frontend first.');
}

const backendDist = join(__dirname, '..', '..', 'backend', 'dist');
const backendTarget = join(__dirname, '..', 'dist', 'backend');

if (existsSync(backendDist)) {
  cpSync(backendDist, backendTarget, { recursive: true });
  // The health controller reads package.json via join(__dirname, '..', '..', 'package.json').
  // When embedded, __dirname is dist/backend/health/, so '../..' resolves to dist/.
  // Copy backend package.json there so the health endpoint can read the version.
  const backendPkg = join(__dirname, '..', '..', 'backend', 'package.json');
  const pkgTarget = join(__dirname, '..', 'dist', 'package.json');
  if (existsSync(backendPkg)) {
    copyFileSync(backendPkg, pkgTarget);
  }
  console.log('Copied backend dist to dist/backend/');
} else {
  console.warn('Backend dist not found — skipping backend copy. Build backend first.');
}
