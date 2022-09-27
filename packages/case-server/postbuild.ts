import * as fs from 'fs';

fs.copyFileSync('README.md', 'dist/README.md');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.main = packageJson.main.replace('dist/', '');
packageJson.types = packageJson.types.replace('dist/', '');
// packageJson.bin = packageJson.bin.replace('dist/', '');
delete packageJson.scripts;

fs.writeFileSync('dist/package.json', JSON.stringify(packageJson, null, 2));
