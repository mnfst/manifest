const fs = require('fs');

const regex = /API_KEY_PREFIX\s*=\s*['"]([^'"]+)['"]/;

const backendSrc = fs.readFileSync(
  'packages/backend/src/common/constants/api-key.constants.ts',
  'utf8',
);
const pluginSrc = fs.readFileSync(
  'packages/openclaw-plugin/src/constants.ts',
  'utf8',
);

const backendMatch = regex.exec(backendSrc);
const pluginMatch = regex.exec(pluginSrc);

if (!backendMatch || !pluginMatch) {
  console.error('Could not extract API_KEY_PREFIX from one or both packages');
  process.exit(1);
}

if (backendMatch[1] !== pluginMatch[1]) {
  console.error(
    `MISMATCH: backend="${backendMatch[1]}" plugin="${pluginMatch[1]}"`,
  );
  process.exit(1);
}

console.log(`OK: API_KEY_PREFIX="${backendMatch[1]}"`);
