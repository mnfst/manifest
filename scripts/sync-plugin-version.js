const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const pkgPath = join(__dirname, '..', 'packages', 'openclaw-plugin', 'package.json');
const pluginJsonPath = join(__dirname, '..', 'packages', 'openclaw-plugin', 'openclaw.plugin.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf-8'));

if (pluginJson.version !== pkg.version) {
  pluginJson.version = pkg.version;
  writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
  console.log(`Synced openclaw.plugin.json version to ${pkg.version}`);
} else {
  console.log(`openclaw.plugin.json version already in sync (${pkg.version})`);
}
