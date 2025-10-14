// This script updates the package.json files of the example projects with the latest version of the "manifest" package.
// It skips updates for beta releases to avoid updating examples with unstable versions.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const MAIN_PACKAGE = 'manifest'
const FOLDERS = [
  // Paths are relative to the root of the "manifest" package where this script is executed.
  // * Add paths to other example projects as needed.
  '../../../examples/main-demo'
]

function getCurrentVersion() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
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
          execSync(`npm install ${MAIN_PACKAGE}@latest`, {
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

updatePackage()
