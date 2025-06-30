import { Args, Command, Flags } from '@oclif/core'
import axios from 'axios'
import { exec as execCp, PromiseWithChild } from 'node:child_process'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
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
import { getBackendFileContent } from '../utils/GetBackendFileContent.js'
import { input } from '@inquirer/prompts'
import { slugify } from '../utils/helpers.js'
import chalk from 'chalk'

const exec = promisify(execCp)

export default class CreateManifest extends Command {
  static description =
    'Create a new Manifest project with the default files and folders.'

  static args = {
    firstArg: Args.string({
      name: 'name',
      description:
        'The name for the new workspace and the initial project. It will be used for the root directory.'
    })
  }

  static flags = {
    backendFile: Flags.string({
      summary:
        'The remote file to use as a template for the manifest.yml file. If not provided, the default file will be used.'
    }),
    cursor: Flags.boolean(),
    copilot: Flags.boolean(),
    windsurf: Flags.boolean()
  }

  /**
   * The run method is called when the command is run.
   *
   * Steps:
   * 1. Create a folder named after the first arg or ask for it
   * 2. Create a folder with the name `manifest`.
   * 3. Create a file inside the folder with the name `manifest.yml`.
   * 4. Update the `package.json` file with the new packages and scripts.
   * 5. Update the .vscode/extensions.json file with the recommended extensions.
   * 6. Update the .vscode/settings.json file with the recommended settings.
   * 7. Update the .gitignore file with the recommended settings.
   * 8. Update the .env file with the environment variables.
   * 9. If no README.md file exists, create one.
   * 10. Add optional files based on flags
   * 11. Install the new packages.
   * 12. Serve the new app.
   * 13. Wait for the server to start.
   * 14. Seed the database.
   * 15. Open the browser.
   */
  async run(): Promise<void> {
    // * 1 Create a folder named after the first argument or ask for it.
    const { argv } = await this.parse(CreateManifest)
    let projectName: string = argv[0] as string

    if (!projectName) {
      projectName = await input({
        message: 'What name would you like to use for the new workspace?',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'The name name cannot be empty'
          }
          // Check for invalid characters in The name names
          if (/[<>:"/\\|?*]/.test(input)) {
            return 'Folder name contains invalid characters'
          }
          return true
        }
      })
    }

    projectName = slugify(projectName)

    const spinner = ora(
      `Creating your Manifest project in ${projectName} folder...`
    ).start()

    const projectFolderPath = path.join(process.cwd(), projectName)

    // Check if the folder already exists
    if (fs.existsSync(projectFolderPath)) {
      spinner.fail(
        `Error: The "${projectFolderPath}" folder already exists in the current directory. Please find another name.`
      )
      process.exit(1)
    }

    fs.mkdirSync(projectFolderPath)

    const manifestFolderName = 'manifest'
    const initialFileName = 'manifest.yml'
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const assetFolderPath = path.join(__dirname, '..', '..', 'assets')

    // * 2. Create a folder with the name `manifest`.
    // Construct the folder path. This example creates the folder in the current working directory.
    const manifestFolderPath = path.join(projectFolderPath, manifestFolderName)

    // Create the folder
    fs.mkdirSync(manifestFolderPath)

    // * 3. Create a file inside the folder with the name `manifest.yml`.
    // Path where the new file should be created
    const newFilePath = path.join(manifestFolderPath, initialFileName)

    // Get the content of the file either remote or local.
    const { flags } = await this.parse(CreateManifest)
    const remoteBackendFile = flags.backendFile
    const content: string = await getBackendFileContent(
      path.join(assetFolderPath, initialFileName),
      remoteBackendFile
    )

    // Write the content to the new file
    fs.writeFileSync(newFilePath, content)

    spinner.succeed()
    spinner.start('Updating package.json file...')

    // Update package.json file.
    const packagePath = path.join(projectFolderPath, 'package.json')
    let packageJson

    if (fs.existsSync(packagePath)) {
      packageJson = parse(fs.readFileSync(packagePath, 'utf8'))
    } else {
      packageJson = JSON.parse(
        fs
          .readFileSync(
            path.join(assetFolderPath, 'default-package.json'),
            'utf8'
          )
          .replace('PROJECT_NAME', projectName)
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
          start: 'node node_modules/manifest/scripts/watch/watch.js',
          seed: 'node node_modules/manifest/dist/manifest/src/seed/scripts/seed.js'
        }
      })
    )

    spinner.succeed()
    spinner.start('Adding settings...')

    // Update .vscode/extensions.json file.
    const vscodeDirPath: string = path.join(projectFolderPath, '.vscode')
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
    const gitignorePath = path.join(projectFolderPath, '.gitignore')
    let gitignoreContent = ''

    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
    }

    const newGitignoreLines: string[] = [
      'node_modules',
      '.env',
      'public',
      'manifest/backend.db' // TODO: Adapt to new folder structure.
    ]
    newGitignoreLines.forEach((line) => {
      if (!gitignoreContent.includes(line)) {
        gitignoreContent += `\n${line}`
      }
    })

    fs.writeFileSync(gitignorePath, gitignoreContent)

    spinner.succeed()

    // * 9. Add a README.md file if it doesn't exist.
    const readmeFilePath = path.join(projectFolderPath, 'README.md')
    if (!fs.existsSync(readmeFilePath)) {
      fs.writeFileSync(
        readmeFilePath,
        fs.readFileSync(path.join(assetFolderPath, 'README.md'), 'utf8')
      )
    }

    // * 10. Add optional files based on flags

    // Add rules for IDEs.
    if (flags.cursor) {
      spinner.start('Adding rules for Cursor IDE...')

      const cursorFolderPath = path.join(projectFolderPath, '.cursor', 'rules')
      const cursorFileName = 'manifest.mdc'

      fs.mkdirSync(cursorFolderPath, { recursive: true })

      let cursorFileContent: string

      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/mnfst/rules/refs/heads/main/cursor/manifest.mdc'
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        cursorFileContent = await response.text()
      } catch (error) {
        console.error('Error fetching file:', error)
        throw error
      }

      // Write the content to the new file
      fs.writeFileSync(
        path.join(cursorFolderPath, cursorFileName),
        cursorFileContent
      )
      spinner.succeed()
    }

    if (flags.copilot) {
      spinner.start('Adding rules for Copilot IDE...')

      const copilotFolderPath = path.join(projectFolderPath, '.github')
      const copilotFileName = 'copilot-instructions.md'

      fs.mkdirSync(copilotFolderPath, { recursive: true })
      let copilotFileContent: string

      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/mnfst/rules/refs/heads/main/copilot/copilot-instructions.md'
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        copilotFileContent = await response.text()
      } catch (error) {
        console.error('Error fetching file:', error)
        throw error
      }
      // Write the content to the new file
      fs.writeFileSync(
        path.join(copilotFolderPath, copilotFileName),
        copilotFileContent
      )
      spinner.succeed()
    }

    if (flags.windsurf) {
      spinner.start('Adding rules for WindSurf IDE...')

      const windsurfFolderPath = path.join(
        projectFolderPath,
        '.windsurf',
        'rules'
      )
      const windsurfFileName = 'manifest.md'

      fs.mkdirSync(windsurfFolderPath, { recursive: true })

      let windsurfFileContent: string

      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/mnfst/rules/refs/heads/main/windsurf/manifest.md'
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        windsurfFileContent = await response.text()
      } catch (error) {
        console.error('Error fetching file:', error)
        throw error
      }

      // Write the content to the new file
      fs.writeFileSync(
        path.join(windsurfFolderPath, windsurfFileName),
        windsurfFileContent
      )
      spinner.succeed()
    }

    // * 9. Install the new packages.
    spinner.start('Installing dependencies...')

    // Install deps.
    try {
      await exec(`cd ${projectName} && npm install --silent`)
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
    }

    //  Serve the new app.
    spinner.succeed()

    spinner.start('Adding environment variables...')
    // Add environment variables to .env file
    const envFilePath = path.join(projectFolderPath, '.env')
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
    spinner.start('Building the database...')

    let serveTask: PromiseWithChild<{ stdout: string; stderr: string }> | null =
      null

    try {
      // We run the manifest script to build the database.
      serveTask = exec(`cd ${projectName} && npm run manifest`)

      await this.waitForServerToBeReady()
      spinner.succeed()
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
    }

    spinner.start('Seeding initial data...')
    try {
      await exec(`cd ${projectName} && npm run manifest:seed`)
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
    }

    spinner.succeed()

    console.log()
    console.log(chalk.bold('🎉 Manifest successfully installed !'))
    console.log()
    console.log('To start the server:')
    console.log()
    console.log(chalk.bold(`  cd ${projectName}`))
    console.log(chalk.bold('  npm run manifest'))
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
   * @returns a promise that resolves to void when the server is ready.
   *
   **/
  async waitForServerToBeReady(): Promise<void> {
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
   * @param jsonString - The JSON with comments.
   *
   * @returns the JSON without comments.
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
