/**
 * Post-build script to inject version numbers, changelog, categories, and meta objects into generated registry JSON files.
 *
 * The shadcn build command doesn't include version fields in the output,
 * so this script reads versions from registry.json and changelog from changelog.json
 * and adds them to each component's JSON file in public/r/.
 *
 * Categories are automatically derived from the file path (e.g., registry/form/date-time-picker.tsx → "form")
 * and injected into the output. This ensures every component has a category.
 *
 * Meta objects (containing preview URLs and other metadata) are also injected if defined in registry.json.
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

/**
 * Extract category from file path.
 * e.g., "registry/form/date-time-picker.tsx" → "form"
 */
function extractCategoryFromPath(filePath) {
  const parts = filePath.split('/')
  // Expected format: registry/<category>/<component>.tsx
  if (parts.length >= 2 && parts[0] === 'registry') {
    return parts[1]
  }
  return null
}

// Read the source registry
const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))

// Read the changelog
let changelog = { components: {} }
if (existsSync(changelogPath)) {
  changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'))
}

let updated = 0
let skipped = 0
let categoryErrors = []
let registryNeedsUpdate = false

for (const item of registry.items) {
  const { name, version: topLevelVersion, files, category: declaredCategory, meta } = item

  // Version can be at top level or inside meta
  const version = topLevelVersion || meta?.version

  if (!version) {
    console.log(`⚠ Skipping ${name}: no version defined`)
    skipped++
    continue
  }

  // Extract category from file path
  const firstFile = files && files[0]
  const derivedCategory = firstFile ? extractCategoryFromPath(firstFile.path) : null

  // Validate or auto-fill category
  let category = declaredCategory
  if (!category && derivedCategory) {
    // Auto-fill category from file path
    category = derivedCategory
    item.category = category
    registryNeedsUpdate = true
    console.log(`✓ Auto-filled category for ${name}: ${category}`)
  } else if (category && derivedCategory && category !== derivedCategory) {
    // Mismatch between declared and derived category
    categoryErrors.push(
      `${name}: declared category "${category}" doesn't match file path category "${derivedCategory}"`
    )
  } else if (!category && !derivedCategory) {
    categoryErrors.push(`${name}: no category found (no files defined)`)
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

  // Add version, category, meta, and changelog fields after name
  const updatedJson = {
    $schema: outputJson.$schema,
    name: outputJson.name,
    version: version,
    category: category || derivedCategory,
    ...(meta && { meta }),
    changelog: componentChangelog,
    ...Object.fromEntries(
      Object.entries(outputJson).filter(([key]) => !['$schema', 'name'].includes(key))
    )
  }

  // Write back
  writeFileSync(outputPath, JSON.stringify(updatedJson, null, 2))
  updated++
}

// Update registry.json if categories were auto-filled
if (registryNeedsUpdate) {
  writeFileSync(registryPath, JSON.stringify(registry, null, 2))
  console.log('✓ Updated registry.json with auto-filled categories')
}

console.log(`✓ Injected versions, categories, meta, and changelog into ${updated} component(s)`)
if (skipped > 0) {
  console.log(`⚠ Skipped ${skipped} component(s)`)
}

// Report category errors
if (categoryErrors.length > 0) {
  console.error('\n❌ Category validation errors:')
  categoryErrors.forEach(err => console.error(`  - ${err}`))
  process.exit(1)
}
