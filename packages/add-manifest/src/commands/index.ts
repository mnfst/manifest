import { Command } from '@oclif/core'
import axios from 'axios'
import { exec as execCp } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import open from 'open'
import ora from 'ora'

import { updateExtensionJsonFile } from '../utils/UpdateExtensionJsonFile.js'
import { updatePackageJsonFile } from '../utils/UpdatePackageJsonFile.js'
import { updateSettingsJsonFile } from '../utils/UpdateSettingsJsonFile.js'

const exec = promisify(execCp)

export class MyCommand extends Command {
  static description = 'Adds Manifest to your project.'

  /**
   * The run method is called when the command is run.
   *
   * Steps:
   * 1. Create a folder with the name `manifest`.
   * 2. Create a file inside the folder with the name `manifest.yml`.
   * 3. Update the `package.json` file with the new packages and scripts.
   * 4. Update the .vscode/extensions.json file with the recommended extensions.
   * 5. Update the .vscode/settings.json file with the recommended settings.
   * 6. Update the .gitignore file with the recommended settings.
   * 7. Update the .env file with the environment variables.
   * 8. Install the new packages.
   * 9. Serve the new app.
   * 10. Wait for the server to start.
   * 11. Seed the database.
   * 12. Open the browser.
   */
  async run(): Promise<void> {
    const folderName = 'manifest'
    const initialFileName = 'backend.yml'
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const assetFolderPath = path.join(__dirname, '..', '..', 'assets')

    const spinner = ora('Add Manifest to your project...').start()

    try {
      // Construct the folder path. This example creates the folder in the current working directory.
      const folderPath = path.join(process.cwd(), folderName)

      // Check if the folder already exists
      if (fs.existsSync(folderPath)) {
        spinner.fail(
          `Error: The "${folderName}" folder already exists in the current directory. Please remove it and try again.`
        )
        process.exit(1)
      }

      // Create the folder
      fs.mkdirSync(folderPath)

      // Path where the new file should be created
      const newFilePath = path.join(folderPath, initialFileName)

      // Read the content from the asset file
      const content = fs.readFileSync(
        path.join(assetFolderPath, initialFileName),
        'utf8'
      )

      // Write the content to the new file
      fs.writeFileSync(newFilePath, content)

      spinner.succeed()
      spinner.start('Update package.json file...')

      // Update package.json file.
      const packagePath = path.join(process.cwd(), 'package.json')
      let packageJson

      if (fs.existsSync(packagePath)) {
        packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      } else {
        packageJson = JSON.parse(
          fs.readFileSync(
            path.join(assetFolderPath, 'default-package.json'),
            'utf8'
          )
        )
      }

      fs.writeFileSync(
        packagePath,
        updatePackageJsonFile({
          fileContent: packageJson,
          newPackages: {
            manifest: '4.0.0-alpha.3'
          },
          newScripts: {
            manifest: 'node node_modules/manifest/scripts/watch/watch.js',
            'manifest:seed': 'node node_modules/manifest/dist/seed/seed.js'
          }
        })
      )

      spinner.succeed()
      spinner.start('Add settings...')

      // Update .vscode/extensions.json file.
      const vscodeDirPath = path.join(process.cwd(), '.vscode')
      const extensionsFilePath = path.join(vscodeDirPath, 'extensions.json')
      let extensionsJson

      //  Ensure the `.vscode` Directory Exists
      if (!fs.existsSync(vscodeDirPath)) {
        fs.mkdirSync(vscodeDirPath)
      }

      // Read or Initialize `extensions.json`
      if (fs.existsSync(extensionsFilePath)) {
        extensionsJson = JSON.parse(fs.readFileSync(extensionsFilePath, 'utf8'))
      } else {
        extensionsJson = { recommendations: [] }
      }

      fs.writeFileSync(
        extensionsFilePath,
        updateExtensionJsonFile({
          extensions: ['redhat.vscode-yaml'],
          fileContent: extensionsJson
        })
      )

      // Update .vscode/extensions.json file.
      const settingsFilePath = path.join(vscodeDirPath, 'settings.json')
      let settingsJson

      // Read or Initialize `settings.json`
      if (fs.existsSync(settingsFilePath)) {
        settingsJson = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'))
      } else {
        settingsJson = {}
      }

      fs.writeFileSync(
        settingsFilePath,
        updateSettingsJsonFile({
          fileContent: settingsJson,
          settings: {
            'yaml.schemas': {
              './node_modules/manifest/dist/manifest/json-schema/manifest-schema.json':
                '**/manifest/**/*.yml'
            }
          }
        })
      )

      // Update the .gitignore file with the recommended settings.
      const gitignorePath = path.join(process.cwd(), '.gitignore')
      let gitignoreContent = ''

      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
      }

      if (!gitignoreContent.includes('node_modules')) {
        gitignoreContent += '\nnode_modules'
        gitignoreContent += '\n.env'
      }

      fs.writeFileSync(gitignorePath, gitignoreContent)

      spinner.succeed()
      spinner.start('Install dependencies...')

      // Install deps.
      try {
        await exec('npm install')
      } catch (error) {
        spinner.fail(`Execution error: ${error}`)
      }

      //  Serve the new app.
      spinner.succeed()

      spinner.start('Add environment variables...')
      // Add environment variables to .env file
      const envFilePath = path.join(process.cwd(), '.env')
      let envContent = ''

      if (fs.existsSync(envFilePath)) {
        envContent = fs.readFileSync(envFilePath, 'utf8')
      }

      envContent += `\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}`

      fs.writeFileSync(envFilePath, envContent)

      spinner.succeed()

      spinner.start('Serve the backend...')
      try {
        const { stdout, stderr } = await exec('npm run manifest')
        if (stderr) {
          this.log(`stderr: ${stderr}`)
        }
        this.log(`stdout: ${stdout}`)
      } catch (error) {
        spinner.fail(`Execution error: ${error}`)
      }
    } catch (error) {
      spinner.fail(`Error: ${error}`)
    }

    // Wait for the server to start
    await this.waitForServerToBeReady()
    spinner.succeed()

    spinner.start('Seed initial data...')
    try {
      const { stderr, stdout } = await exec('npm run manifest:seed')
      if (stderr) {
        this.log(`stderr: ${stderr}`)
      }
      this.log(`stdout: ${stdout}`)
      this.log('Database seeded successfully!')
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
    }

    spinner.succeed()

    open('http://localhost:1111/auth/login')
  }

  /**
   * Check if the server is ready.
   *
   * @returns {Promise<boolean>} - Returns a promise that resolves to a boolean.
   *
   **/
  async isServerReady(): Promise<boolean> {
    return axios
      .get('http://localhost:1111/health')
      .then(() => true)
      .catch(() => false)
  }

  /**
   * Wait for the server to be ready.
   *
   * @returns {Promise<void>} - Returns a promise that resolves to void when the server is ready.
   *
   **/
  async waitForServerToBeReady() {
    let serverReady = false
    while (!serverReady) {
      serverReady = await this.isServerReady()
      if (!serverReady) {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1s before retrying
      }
    }
  }
}
