#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const FIXTURES = path.join(HERE, '__fixtures__');
const RENDERER = path.join(HERE, 'render-diagram.cjs');
const GOLDEN = path.join(FIXTURES, 'expected-comment.md');

const MIGRATION_FILES = [
  'packages/backend/src/database/migrations/1779000000000-AddRoutingTiers.ts',
  'packages/backend/src/database/migrations/1779100000000-RefactorAgents.ts',
  'packages/backend/src/database/migrations/1779200000000-DropLegacyMetrics.ts',
  'packages/backend/src/database/migrations/1779300000000-RekeyProviderKeys.ts',
].join('\n');

const result = spawnSync(
  process.execPath,
  [RENDERER, path.join(FIXTURES, 'base.json'), path.join(FIXTURES, 'head.json')],
  {
    env: { ...process.env, MIGRATION_FILES },
    encoding: 'utf8',
  },
);

if (result.status !== 0) {
  process.stderr.write(`Renderer exited with code ${result.status}\n`);
  process.stderr.write(result.stderr || '');
  process.exit(1);
}

const actual = result.stdout;

if (process.env.UPDATE_GOLDEN === '1') {
  fs.writeFileSync(GOLDEN, actual);
  process.stdout.write(`✓ Updated golden file at ${path.relative(process.cwd(), GOLDEN)}\n`);
  process.exit(0);
}

const expected = fs.readFileSync(GOLDEN, 'utf8');

if (actual === expected) {
  process.stdout.write('✓ db-diagram renderer output matches golden fixture\n');
  process.exit(0);
}

process.stderr.write('✗ db-diagram renderer output drifted from golden fixture.\n\n');
process.stderr.write(unifiedDiff(expected, actual));
process.stderr.write(
  '\nIf this change is intentional, regenerate the fixture:\n' +
    '  UPDATE_GOLDEN=1 node .github/scripts/db-diagram/smoke-test.cjs\n',
);
process.exit(1);

function unifiedDiff(a, b) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const out = [];
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) {
      if (aLines[i] !== undefined) out.push(`- ${aLines[i]}`);
      if (bLines[i] !== undefined) out.push(`+ ${bLines[i]}`);
    }
  }
  return out.join('\n');
}
