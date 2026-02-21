const { cpSync, existsSync } = require('fs');
const { join } = require('path');

const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
const target = join(__dirname, '..', 'public');

if (existsSync(frontendDist)) {
  cpSync(frontendDist, target, { recursive: true });
  console.log('Copied frontend assets to public/');
} else {
  console.warn('Frontend dist not found — skipping asset copy. Build frontend first.');
}
