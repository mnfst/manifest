import { Command } from '@oclif/core'
import axios from 'axios'
import { PromiseWithChild, exec as execCp } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import ora from 'ora'
import treeKill from 'tree-kill'
import { parse } from 'jsonc-parser'

import { updateExtensionJsonFile } from '../utils/UpdateExtensionJsonFile.js'
import { updatePackageJsonFile } from '../utils/UpdatePackageJsonFile.js'
import { updateSettingsJsonFile } from '../utils/UpdateSettingsJsonFile.js'
import { getLatestPackageVersion } from '../utils/GetLatestPackageVersion.js'

const exec = promisify(execCp)

export class MyCommand extends Command {
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
   * 8. If no README.md file exists, create one.
   * 9. Install the new packages.
   * 10. Serve the new app.
   * 11. Wait for the server to start.
   * 12. Seed the database.
   * 13. Open the browser.
   */
  async run(): Promise<void> {
    const folderName = 'manifest'
    const initialFileName = 'backend.yml'
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const assetFolderPath = path.join(__dirname, '..', '..', 'assets')

    const spinner = ora('Add Manifest to your project...').start()

    // * 1. Create a folder with the name `manifest`.
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

    // * 2. Create a file inside the folder with the name `manifest.yml`.
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
      packageJson = parse(fs.readFileSync(packagePath, 'utf8'))
    } else {
      packageJson = JSON.parse(
        fs.readFileSync(
          path.join(assetFolderPath, 'default-package.json'),
          'utf8'
        )
      )
    }

    const manifestLatestVersion: string =
      await getLatestPackageVersion('manifest')

    fs.writeFileSync(
      packagePath,
      updatePackageJsonFile({
        fileContent: packageJson,
        newPackages: {
          manifest: `^${manifestLatestVersion}`
        },
        newScripts: {
          manifest: 'node node_modules/manifest/scripts/watch/watch.js',
          'manifest:seed':
            'node node_modules/manifest/dist/manifest/src/seed/scripts/seed.js'
        }
      })
    )

    spinner.succeed()
    spinner.start('Add settings...')

    // Update .vscode/extensions.json file.
    const vscodeDirPath: string = path.join(process.cwd(), '.vscode')
    const extensionsFilePath: string = path.join(
      vscodeDirPath,
      'extensions.json'
    )
    let extensionsJson

    //  Ensure the `.vscode` Directory Exists
    if (!fs.existsSync(vscodeDirPath)) {
      fs.mkdirSync(vscodeDirPath)
    }

    // Read or Initialize `extensions.json`
    if (fs.existsSync(extensionsFilePath)) {
      extensionsJson = parse(fs.readFileSync(extensionsFilePath, 'utf8'))
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
      settingsJson = parse(fs.readFileSync(settingsFilePath, 'utf8'))
    } else {
      settingsJson = {}
    }

    fs.writeFileSync(
      settingsFilePath,
      updateSettingsJsonFile({
        fileContent: settingsJson,
        settings: {
          'yaml.schemas': {
            'https://schema.manifest.build/schema.json': '**/manifest/**.yml'
          }
        }
      })
    )

    // * 7. Update the .env file with the environment variables.
    const gitignorePath = path.join(process.cwd(), '.gitignore')
    let gitignoreContent = ''

    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
    }

    const newGitignoreLines: string[] = [
      'node_modules',
      '.env',
      'public',
      'manifest/backend.db'
    ]
    newGitignoreLines.forEach((line) => {
      if (!gitignoreContent.includes(line)) {
        gitignoreContent += `\n${line}`
      }
    })

    fs.writeFileSync(gitignorePath, gitignoreContent)

    spinner.succeed()

    // * 8. Add a README.md file if it doesn't exist.
    const readmeFilePath = path.join(process.cwd(), 'README.md')
    if (!fs.existsSync(readmeFilePath)) {
      fs.writeFileSync(
        readmeFilePath,
        fs.readFileSync(path.join(assetFolderPath, 'README.md'), 'utf8')
      )
    }

    // * 9. Install the new packages.
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
    const envJWTSecret = `TOKEN_SECRET_KEY=${crypto
      .randomBytes(32)
      .toString('hex')}`

    let envContent: string

    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8')
      envContent += `\n` + envJWTSecret
    } else {
      envContent = envJWTSecret
    }

    fs.writeFileSync(envFilePath, envContent)

    spinner.succeed()
    spinner.start('Build the database...')

    let serveTask: PromiseWithChild<{ stdout: string; stderr: string }> | null =
      null

    try {
      // We run the manifest script to build the database.
      serveTask = exec('npm run manifest')

      await this.waitForServerToBeReady()
      spinner.succeed()
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
    }

    spinner.start('Seed initial data...')
    try {
      await exec('npm run manifest:seed')
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
    }

    spinner.succeed()

    console.log()
    console.log('🎉 Manifest successfully installed !')
    console.log()
    console.log('🚀 Run `npm run manifest` to start the server.')
    console.log()

    await this.silentKill(serveTask?.child?.pid || 0)
    process.exit()
  }

  /**
   * Check if the server is ready.
   *
   * @returns {Promise<boolean>} - Returns a promise that resolves to a boolean.
   *
   **/
  async isServerReady(): Promise<boolean> {
    return axios
      .get('http://localhost:1111/api/health')
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

  /**
   * Transform a JSON with comments to a JSON without comments.
   *
   * @param {string} jsonWithComments - The JSON with comments.
   *
   * @returns {string} - The JSON without comments.
   *
   **/
  removeComments(jsonString: string): string {
    return jsonString
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
  }

  /**
   * Kill a process without logging an error if it fails.
   *
   * @param {number} pid - The process ID.
   * @returns {Promise<void>} - A promise that resolves when the process is killed.
   *
   */
  silentKill(pid: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      treeKill(pid, 'SIGKILL', (err) => {
        if (err) {
          reject(`Failed to kill process: ${err}`)
        } else {
          resolve()
        }
      })
    })
  }
}
