const { cpSync, copyFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const frontendDist = join(__dirname, '..', '..', '..', 'frontend', 'dist');
const frontendTarget = join(__dirname, '..', 'public');

if (existsSync(frontendDist)) {
  cpSync(frontendDist, frontendTarget, {
    recursive: true,
    filter: (src) => !src.endsWith('og-image.png'),
  });
  console.log('Copied frontend assets to public/');
} else {
  console.error('ERROR: Frontend dist not found at', frontendDist);
  console.error('Run "npm run build" from the monorepo root first.');
  process.exit(1);
}

const backendDist = join(__dirname, '..', '..', '..', 'backend', 'dist');
const backendTarget = join(__dirname, '..', 'dist', 'backend');

if (existsSync(backendDist)) {
  cpSync(backendDist, backendTarget, {
    recursive: true,
    filter: (src) => !src.endsWith('.js.map') && !src.endsWith('.d.ts'),
  });
  // The health controller reads package.json via join(__dirname, '..', '..', 'package.json').
  // When embedded, __dirname is dist/backend/health/, so '../..' resolves to dist/.
  // Copy backend package.json there so the health endpoint can read the version.
  const backendPkg = join(__dirname, '..', '..', '..', 'backend', 'package.json');
  const pkgTarget = join(__dirname, '..', 'dist', 'package.json');
  if (existsSync(backendPkg)) {
    copyFileSync(backendPkg, pkgTarget);
  }
  console.log('Copied backend dist to dist/backend/');
} else {
  console.error('ERROR: Backend dist not found at', backendDist);
  console.error('Run "npm run build" from the monorepo root first.');
  process.exit(1);
}

// Copy manifest-shared so the embedded backend can resolve require('manifest-shared')
const sharedDist = join(__dirname, '..', '..', '..', 'shared', 'dist');
const sharedPkg = join(__dirname, '..', '..', '..', 'shared', 'package.json');
const sharedTarget = join(__dirname, '..', 'dist', 'node_modules', 'manifest-shared');

if (existsSync(sharedDist)) {
  mkdirSync(sharedTarget, { recursive: true });
  cpSync(sharedDist, join(sharedTarget, 'dist'), { recursive: true });
  copyFileSync(sharedPkg, join(sharedTarget, 'package.json'));
  console.log('Copied manifest-shared to dist/node_modules/manifest-shared/');
} else {
  console.error('ERROR: shared dist not found at', sharedDist);
  console.error('Run "npm run build" from the monorepo root first.');
  process.exit(1);
}
