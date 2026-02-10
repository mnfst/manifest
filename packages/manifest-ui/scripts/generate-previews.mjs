#!/usr/bin/env node

/**
 * Generate preview images for all components using Playwright.
 *
 * This script:
 * 1. Reads registry.json to get the list of components
 * 2. Launches a headless browser via Playwright
 * 3. Navigates to /preview/[component] for each component
 * 4. Takes a screenshot and saves it to public/previews/
 * 5. Updates registry.json with the preview URL
 *
 * Usage:
 *   node scripts/generate-previews.mjs [--base-url=http://localhost:3001] [--component=name]
 *
 * Options:
 *   --base-url    Base URL of the running dev server (default: http://localhost:3001)
 *   --component   Generate preview for a specific component only
 *   --dry-run     Show what would be generated without actually generating
 *   --verbose     Enable verbose logging
 */

/* eslint-disable no-undef */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Configuration
const REGISTRY_PATH = join(rootDir, 'registry.json')
const OUTPUT_DIR = join(rootDir, 'public', 'previews')
const BASE_URL_DEFAULT = 'http://localhost:3001'
const PREVIEW_BASE_URL = 'https://ui.manifest.build'

// Viewport for consistent screenshots (optimized for og:image)
const VIEWPORT = {
  width: 1200,
  height: 630
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    baseUrl: BASE_URL_DEFAULT,
    component: null,
    dryRun: false,
    verbose: false
  }

  for (const arg of args) {
    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.split('=')[1]
    } else if (arg.startsWith('--component=')) {
      options.component = arg.split('=')[1]
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--verbose') {
      options.verbose = true
    }
  }

  return options
}

// Logger with verbosity support
function createLogger(verbose) {
  return {
    info: (...args) => console.log(...args),
    debug: (...args) => verbose && console.log('[DEBUG]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    success: (...args) => console.log('✓', ...args),
    warn: (...args) => console.log('⚠', ...args)
  }
}

async function generatePreviews() {
  const options = parseArgs()
  const log = createLogger(options.verbose)

  log.info('🖼️  Component Preview Generator')
  log.info('================================')
  log.debug('Options:', options)

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
    log.debug('Created output directory:', OUTPUT_DIR)
  }

  // Read registry
  if (!existsSync(REGISTRY_PATH)) {
    log.error('Registry file not found:', REGISTRY_PATH)
    process.exit(1)
  }

  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
  // Only generate previews for visual block components (skip registry:lib like manifest-types)
  let components = registry.items.filter((c) => c.type === 'registry:block')

  // Filter to specific component if requested
  if (options.component) {
    components = components.filter((c) => c.name === options.component)
    if (components.length === 0) {
      log.error(`Component not found: ${options.component}`)
      process.exit(1)
    }
  }

  log.info(`Found ${components.length} component(s) to process`)

  if (options.dryRun) {
    log.info('\n[DRY RUN] Would generate previews for:')
    for (const component of components) {
      log.info(`  - ${component.name} (${component.category})`)
    }
    return
  }

  // Launch browser
  log.info('\nLaunching browser...')
  const browser = await chromium.launch({
    headless: true
  })

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1 // Standard 1200x630 for OG images
  })

  const page = await context.newPage()

  // Track results
  const results = {
    success: [],
    failed: [],
    skipped: []
  }

  // Generate previews
  for (const component of components) {
    const { name } = component
    const previewUrl = `${options.baseUrl}/preview/${name}`
    const outputPath = join(OUTPUT_DIR, `${name}.png`)

    log.info(`\nProcessing: ${name}`)
    log.debug(`  URL: ${previewUrl}`)
    log.debug(`  Output: ${outputPath}`)

    try {
      // Navigate to preview page (use domcontentloaded instead of networkidle
      // because some components like event-detail have maps that never go idle)
      await page.goto(previewUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // Wait for the preview to be ready
      await page.waitForSelector('[data-preview-ready="true"]', {
        timeout: 10000
      })

      // Small delay for any animations to settle
      await page.waitForTimeout(500)

      // Hide Next.js dev overlay so it doesn't appear in screenshots
      await page.evaluate(() => {
        document.querySelectorAll('[data-nextjs-dev-overlay], nextjs-portal, next-route-announcer').forEach(el => el.remove())
      })

      // Take screenshot
      await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: false
      })

      log.success(`Generated: ${name}.png`)
      results.success.push(name)
    } catch (error) {
      log.error(`Failed to generate preview for ${name}:`, error.message)
      results.failed.push({ name, error: error.message })
    }
  }

  // Close browser
  await browser.close()

  // Update registry.json with preview URLs
  log.info('\nUpdating registry.json with preview URLs...')

  let registryUpdated = false
  for (const item of registry.items) {
    if (results.success.includes(item.name)) {
      const previewUrl = `${PREVIEW_BASE_URL}/previews/${item.name}.png`
      if (item.preview !== previewUrl) {
        item.preview = previewUrl
        registryUpdated = true
      }
    }
  }

  if (registryUpdated) {
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n')
    log.success('Updated registry.json with preview URLs')
  } else {
    log.info('No registry updates needed')
  }

  // Summary
  log.info('\n================================')
  log.info('Summary:')
  log.info(`  ✓ Success: ${results.success.length}`)
  log.info(`  ✗ Failed: ${results.failed.length}`)

  if (results.failed.length > 0) {
    log.info('\nFailed components:')
    for (const { name, error } of results.failed) {
      log.info(`  - ${name}: ${error}`)
    }
  }

  // Exit with error if any failed
  if (results.failed.length > 0) {
    process.exit(1)
  }
}

// Run the script
generatePreviews().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
