#!/usr/bin/env node

/**
 * Build script that generates component preview images as part of the build.
 *
 * This replaces the previous workflow where previews were generated in CI
 * and committed back to the repository. Now previews are generated during
 * the build and included in the build output (not tracked in Git).
 *
 * Preview generation requires Playwright with Chromium installed. If Chromium
 * is not available (e.g. on Vercel), preview generation is skipped gracefully.
 *
 * Steps:
 * 1. Build the registry (shadcn build + inject versions)
 * 2. Start a temporary dev server
 * 3. Generate preview images using Playwright
 * 4. Stop the dev server
 * 5. Run next build (previews are now in public/previews/)
 */

/* eslint-disable no-undef */
import { execSync, spawn } from 'child_process'
import { dirname, join } from 'path'
import { readdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const DEV_SERVER_PORT = 3099
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`
const MAX_WAIT_SECONDS = 120

function run(cmd, label) {
  console.log(`\n▶ ${label}`)
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' })
}

/**
 * Check if Playwright's Chromium browser is installed by looking
 * for a chromium directory in the Playwright cache.
 */
function isPlaywrightChromiumInstalled() {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const cacheLocations = [
    join(home, '.cache', 'ms-playwright'),
    join(home, 'Library', 'Caches', 'ms-playwright'),
    join(home, 'AppData', 'Local', 'ms-playwright')
  ]

  for (const cacheDir of cacheLocations) {
    if (!existsSync(cacheDir)) continue
    try {
      const entries = readdirSync(cacheDir)
      if (entries.some((e) => e.startsWith('chromium'))) {
        return true
      }
    } catch {
      // ignore
    }
  }

  return false
}

async function waitForServer(url, maxSeconds) {
  const http = await import('http')
  for (let i = 0; i < maxSeconds; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume()
          resolve(res.statusCode)
        })
        req.on('error', reject)
        req.setTimeout(1000, () => {
          req.destroy()
          reject(new Error('timeout'))
        })
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return false
}

async function main() {
  const skipPreviews = process.argv.includes('--skip-previews')

  // Step 1: Build the registry
  run('pnpm run registry:build', 'Building registry...')

  // Determine whether to generate previews
  const canGeneratePreviews = !skipPreviews && isPlaywrightChromiumInstalled()

  if (skipPreviews) {
    console.log('\n⏭ Skipping preview generation (--skip-previews)')
  } else if (!canGeneratePreviews) {
    console.log('\n⏭ Skipping preview generation (Playwright Chromium not installed)')
    console.log('  To generate previews locally, run: npx playwright install chromium')
  } else {
    // Step 2: Start a temporary dev server on a non-conflicting port
    console.log(`\n▶ Starting temporary dev server on port ${DEV_SERVER_PORT}...`)
    const devServer = spawn('npx', ['next', 'dev', '--turbopack', '-p', String(DEV_SERVER_PORT)], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    })

    // Log server output for debugging
    devServer.stdout.on('data', (data) => {
      const msg = data.toString().trim()
      if (msg) console.log(`  [dev] ${msg}`)
    })
    devServer.stderr.on('data', (data) => {
      const msg = data.toString().trim()
      if (msg && !msg.includes('ExperimentalWarning')) {
        console.log(`  [dev] ${msg}`)
      }
    })

    try {
      // Step 3: Wait for the server to be ready
      console.log('  Waiting for dev server to be ready...')
      const ready = await waitForServer(DEV_SERVER_URL, MAX_WAIT_SECONDS)
      if (!ready) {
        throw new Error(`Dev server did not start within ${MAX_WAIT_SECONDS}s`)
      }
      console.log('  Dev server is ready!')

      // Step 4: Generate previews
      run(
        `node scripts/generate-previews.mjs --base-url=${DEV_SERVER_URL} --verbose`,
        'Generating component previews...'
      )
    } finally {
      // Step 5: Stop the dev server
      console.log('\n▶ Stopping dev server...')
      devServer.kill('SIGTERM')
      // Give it a moment to shut down
      await new Promise((r) => setTimeout(r, 1000))
      if (!devServer.killed) {
        devServer.kill('SIGKILL')
      }
    }
  }

  // Step 6: Run next build
  run('npx next build', 'Running Next.js build...')

  console.log('\n✓ Build complete!')
}

main().catch((error) => {
  console.error('\n✗ Build failed:', error.message)
  process.exit(1)
})
