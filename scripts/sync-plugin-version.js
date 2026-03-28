const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const packages = [
  { dir: 'manifest-model-router', label: 'manifest-model-router' },
  { dir: 'manifest', label: 'manifest' },
];

for (const { dir, label } of packages) {
  const pkgPath = join(__dirname, '..', 'packages', 'openclaw-plugins', dir, 'package.json');
  const pluginJsonPath = join(__dirname, '..', 'packages', 'openclaw-plugins', dir, 'openclaw.plugin.json');

  if (!existsSync(pkgPath) || !existsSync(pluginJsonPath)) {
    console.error(`ERROR: Missing expected files for ${label}: ${pkgPath} or ${pluginJsonPath}`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));

  if (pluginJson.version !== pkg.version) {
    pluginJson.version = pkg.version;
    writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
    console.log(`Synced ${label}/openclaw.plugin.json version to ${pkg.version}`);
  } else {
    console.log(`${label}/openclaw.plugin.json version already in sync (${pkg.version})`);
  }
}
