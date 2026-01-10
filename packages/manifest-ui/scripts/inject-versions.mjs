/**
 * Post-build script to inject version numbers into generated registry JSON files.
 *
 * The shadcn build command doesn't include version fields in the output,
 * so this script reads versions from registry.json and adds them to each
 * component's JSON file in public/r/.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const registryPath = join(rootDir, 'registry.json')
const outputDir = join(rootDir, 'public', 'r')

// Read the source registry
const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))

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

  // Add version field after name
  const updatedJson = {
    $schema: outputJson.$schema,
    name: outputJson.name,
    version: version,
    ...Object.fromEntries(
      Object.entries(outputJson).filter(([key]) => !['$schema', 'name'].includes(key))
    )
  }

  // Write back
  writeFileSync(outputPath, JSON.stringify(updatedJson, null, 2))
  updated++
}

console.log(`✓ Injected versions into ${updated} component(s)`)
if (skipped > 0) {
  console.log(`⚠ Skipped ${skipped} component(s)`)
}
