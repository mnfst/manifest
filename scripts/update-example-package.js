// This script updates the package.json files of the example projects with the latest version of the "manifest" package.
// It skips updates for beta releases to avoid updating examples with unstable versions.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const MAIN_PACKAGE = 'manifest'
const FOLDERS = [
  // Paths are relative to the root of the "manifest" package where this script is executed.
  // * Add paths to other example projects as needed.
  './examples/main-demo'
]

function getCurrentVersion() {
  try {
    const packageJsonPath = path.join(
      process.cwd(),
      'packages',
      'core',
      'manifest',
      'package.json'
    )

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.version
  } catch (err) {
    console.error('Failed to read current package version:', err.message)
    return null
  }
}

function isBetaVersion(version) {
  if (!version) return false

  // Check for common beta patterns: beta, alpha, rc, pre, etc.
  const betaPatterns = [
    /beta/i,
    /alpha/i,
    /rc/i,
    /pre/i,
    /-\d+$/, // Matches versions ending with -1, -2, etc.
    /\d+\.\d+\.\d+-.+/ // Matches any version with a prerelease identifier
  ]

  return betaPatterns.some((pattern) => pattern.test(version))
}

async function waitForPackageOnNpm(
  packageName,
  version,
  maxAttempts = 30,
  delayMs = 10000
) {
  console.log(`Waiting for ${packageName}@${version} to be available on npm...`)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = execSync(`npm view ${packageName}@${version} version`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim()

      if (result === version) {
        console.log(`✅ ${packageName}@${version} is now available on npm!`)
        return true
      }
    } catch (err) {
      // Package version not found yet
    }

    console.log(
      `Attempt ${attempt}/${maxAttempts}: Package not available yet. Waiting ${delayMs / 1000}s...`
    )
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  console.error(
    `❌ Package ${packageName}@${version} did not become available after ${maxAttempts} attempts`
  )
  return false
}

function updatePackage() {
  const currentVersion = getCurrentVersion()

  if (!currentVersion) {
    console.error('Cannot determine current version. Aborting update.')
    return
  }

  console.log(`Current version: ${currentVersion}`)

  if (isBetaVersion(currentVersion)) {
    console.log(
      'ⓘ Beta version detected. Skipping example updates to avoid unstable releases.'
    )
    console.log('Examples will only be updated for stable releases.')
    return
  }

  console.log('✅ Stable version detected. Proceeding with example updates...')

  FOLDERS.forEach((folder) => {
    const packageJsonPath = path.join(folder, 'package.json')

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

      // Check if the package is listed as a dependency or devDependency
      if (
        (packageJson.dependencies && packageJson.dependencies[MAIN_PACKAGE]) ||
        (packageJson.devDependencies &&
          packageJson.devDependencies[MAIN_PACKAGE])
      ) {
        console.log(`Updating ${MAIN_PACKAGE} in ${folder}...`)
        try {
          execSync(`npm install ${MAIN_PACKAGE}@${currentVersion}`, {
            cwd: folder,
            stdio: 'inherit'
          })
          console.log(`Successfully updated ${MAIN_PACKAGE} in ${folder}`)
        } catch (err) {
          console.error(
            `Failed to update ${MAIN_PACKAGE} in ${folder}:`,
            err.message
          )
        }
      }
    } else {
      console.warn(`No package.json found in ${folder}. Skipping...`)
    }
  })
}

async function main() {
  const currentVersion = getCurrentVersion()

  if (!currentVersion || isBetaVersion(currentVersion)) {
    updatePackage() // Will handle the early exit
    return
  }

  // Wait for the package to be available on npm
  const isAvailable = await waitForPackageOnNpm(MAIN_PACKAGE, currentVersion)

  if (!isAvailable) {
    console.error('Aborting example updates due to package unavailability.')
    process.exit(1)
  }

  updatePackage()
}

main()
