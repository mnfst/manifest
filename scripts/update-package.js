// This script updates the package.json files with the latest version of the "manifest" package.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const MAIN_PACKAGE = 'manifest'
const FOLDERS = [
  // Paths are relative to the root of the "manifest" package where this script is executed.
  '../../../examples/main-demo',
  '../../../examples/website/auth',
  '../../../examples/website/collections',
  '../../../examples/website/relations',
  '../../../examples/website/singles',
  '../../../examples/website/storage',
  '../../../examples/website/validation'
]

function updatePackage() {
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
