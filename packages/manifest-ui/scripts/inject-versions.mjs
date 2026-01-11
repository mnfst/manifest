/**
 * Post-build script to inject version numbers and changelog into generated registry JSON files.
 *
 * The shadcn build command doesn't include version fields in the output,
 * so this script reads versions from registry.json and changelog from changelog.json
 * and adds them to each component's JSON file in public/r/.
 */

/* eslint-disable no-undef */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const registryPath = join(rootDir, 'registry.json')
const changelogPath = join(rootDir, 'changelog.json')
const outputDir = join(rootDir, 'public', 'r')

// Read the source registry
const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))

// Read the changelog
let changelog = { components: {} }
if (existsSync(changelogPath)) {
  changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'))
}

let updated = 0
let skipped = 0

for (const item of registry.items) {
  const { name, version } = item

  if (!version) {
    console.log(`⚠ Skipping ${name}: no version defined`)
    skipped++
    continue
  }

  const outputPath = join(outputDir, `${name}.json`)

  if (!existsSync(outputPath)) {
    console.log(`⚠ Skipping ${name}: output file not found`)
    skipped++
    continue
  }

  // Read the generated JSON
  const outputJson = JSON.parse(readFileSync(outputPath, 'utf-8'))

  // Get changelog for this component
  const componentChangelog = changelog.components[name] || {}

  // Add version and changelog fields after name
  const updatedJson = {
    $schema: outputJson.$schema,
    name: outputJson.name,
    version: version,
    changelog: componentChangelog,
    ...Object.fromEntries(
      Object.entries(outputJson).filter(([key]) => !['$schema', 'name'].includes(key))
    )
  }

  // Write back
  writeFileSync(outputPath, JSON.stringify(updatedJson, null, 2))
  updated++
}

console.log(`✓ Injected versions and changelog into ${updated} component(s)`)
if (skipped > 0) {
  console.log(`⚠ Skipped ${skipped} component(s)`)
}
