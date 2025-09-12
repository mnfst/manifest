#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: node scripts/verify-create-manifest.mjs <projectName> [--expect-windsurf]')
  process.exit(2)
}

const projectName = args[0]
const expectWindsurf = args.includes('--expect-windsurf')

const base = path.resolve(projectName)

// sanity existence checks
if (fs.existsSync(base)) {
  ok(`project folder exists: ${base}`)
} else {
  fail(`project folder missing: ${base}`)
}

const mustExist = [
  'manifest.yml',
  '.manifest',
  '.vscode',
  '.vscode/extensions.json',
  '.vscode/settings.json',
  '.gitignore',
  'package.json',
  '.env',
  'README.md'
]

for (const rel of mustExist) {
  const p = path.join(base, rel)
  if (fs.existsSync(p)) {
    ok(`${rel} exists`)
  } else {
    fail(`${rel} missing`)
  }
}

// Check manifest.yml has content and expected key from the provided backend file
try {
  const manifest = fs.readFileSync(path.join(base, 'manifest.yml'), 'utf8')
  if (manifest.trim().length > 0 && /entities:\s*$/m.test(manifest)) {
    ok('manifest.yml seems valid (contains entities)')
  } else {
    fail('manifest.yml does not contain expected content')
  }
} catch (e) {
  fail(`cannot read manifest.yml: ${e}`)
}

// Ensure the dependency was added
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'))
  if (pkg?.dependencies?.manifest) {
    ok('package.json includes manifest dependency')
  } else {
    fail('package.json missing manifest dependency')
  }
} catch (e) {
  fail(`cannot read/parse package.json: ${e}`)
}

// Verify .gitignore contains expected lines
try {
  const gi = fs.readFileSync(path.join(base, '.gitignore'), 'utf8')
  const required = ['node_modules', '.env', 'public', '.manifest']
  for (const entry of required) {
    if (gi.includes(entry)) {
      ok(`.gitignore contains ${entry}`)
    } else {
      fail(`.gitignore missing ${entry}`)
    }
  }
} catch (e) {
  fail(`cannot read .gitignore: ${e}`)
}

// Optionally verify a flag effect (works with parameters)
if (expectWindsurf) {
  const windsurfFile = path.join(base, '.windsurf', 'rules', 'manifest.md')
  if (fs.existsSync(windsurfFile)) {
    ok('windsurf rules created via flag')
  } else {
    fail('windsurf rules missing though flag was provided')
  }
}

process.exit(process.exitCode ?? 0)

