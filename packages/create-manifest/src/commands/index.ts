import { Args, Command, Flags } from '@oclif/core'
import axios from 'axios'
import { exec as execCp, spawn, ChildProcess } from 'node:child_process'
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

/**
 * Execute a command in a specific directory with cross-platform support
 * @param command - The command to execute
 * @param cwd - The working directory
 * @returns Promise with stdout and stderr
 */
async function execInDirectory(
  command: string,
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return exec(command, { cwd })
}

/**
 * Spawn a command in a specific directory that runs in the background
 * @param command - The command to execute
 * @param args - The command arguments
 * @param cwd - The working directory
 * @returns ChildProcess
 */
function spawnInDirectory(command: string, args: string[], cwd: string) {
  const isWindows = process.platform === 'win32'

  if (isWindows) {
    // On Windows, use shell to resolve npm command
    return spawn(command, args, {
      cwd,
      stdio: 'pipe',
      detached: false,
      shell: true
    })
  } else {
    // On Unix systems, spawn directly
    return spawn(command, args, {
      cwd,
      stdio: 'pipe',
      detached: false
    })
  }
}

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
    // let isMonorepo: boolean = argv[1] === 'monorepo'
    const isMonorepo = false // Hide this feature.

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

    // if (!isMonorepo) {
    //   const projectType = await select({
    //     message: 'What type of project would you like to develop?',
    //     choices: [
    //       {
    //         name: 'A full-stack app (monorepo)',
    //         value: 'monorepo',
    //         description: 'Creates a monorepo with both "web" and "api" folders'
    //       },
    //       {
    //         name: 'A standalone backend',
    //         value: 'standalone',
    //         description: 'Creates a backend-only project'
    //       }
    //     ]
    //   })

    //   isMonorepo = projectType === 'monorepo'
    // }

    projectName = slugify(projectName)

    const spinner = ora(
      `Creating your Manifest project in ${projectName} folder...`
    ).start()

    const rootFolderPath: string = path.join(process.cwd(), projectName)

    // Check if the folder already exists
    if (fs.existsSync(rootFolderPath)) {
      spinner.fail(
        `Error: The "${rootFolderPath}" folder already exists in the current directory. Please find another name.`
      )
      process.exit(1)
    }

    fs.mkdirSync(rootFolderPath)

    let projectFolderPath: string

    if (isMonorepo) {
      // If it's a monorepo, create a folder for the project.
      projectFolderPath = path.join(rootFolderPath, 'api')
      fs.mkdirSync(projectFolderPath)

      fs.mkdirSync(path.join(rootFolderPath, 'web'))
    } else {
      // If it's a standalone backend, use the root folder as the project folder.
      projectFolderPath = rootFolderPath
    }

    const manifestFolderName = '.manifest'
    const initialFileName = 'manifest.yml'
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const assetFolderPath = path.join(
      __dirname,
      '..',
      '..',
      'assets',
      isMonorepo ? 'monorepo' : 'standalone'
    )

    // * 2. Create a folder with the name `.manifest` for compiled files.
    // Construct the folder path. This example creates the folder in the current working directory.
    const compiledFolderPath = path.join(projectFolderPath, manifestFolderName)

    // Create the folder
    fs.mkdirSync(compiledFolderPath)

    // * 3. Create a file with the name `manifest.yml`.
    const newFilePath = path.join(projectFolderPath, initialFileName)

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
    spinner.start('Creating package.json file...')

    // Update package.json file.
    const packagePath = path.join(projectFolderPath, 'package.json')

    const packageJson = JSON.parse(
      fs
        .readFileSync(path.join(assetFolderPath, 'api-package.json'), 'utf8')
        .replace('PROJECT_NAME', projectName)
    )

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

    if (isMonorepo) {
      // If it's a monorepo, also update the web package.json file and the root package.json file.
      const webPackagePath = path.join(rootFolderPath, 'web', 'package.json')
      fs.writeFileSync(
        webPackagePath,
        fs
          .readFileSync(path.join(assetFolderPath, 'web-package.json'), 'utf8')
          .replace('PROJECT_NAME', projectName)
      )

      const rootPackagePath = path.join(rootFolderPath, 'package.json')
      fs.writeFileSync(
        rootPackagePath,
        fs
          .readFileSync(path.join(assetFolderPath, 'root-package.json'), 'utf8')
          .replace('PROJECT_NAME', projectName)
      )
    }

    spinner.succeed()
    spinner.start('Adding settings...')

    // Update .vscode/extensions.json file.
    const vscodeDirPath: string = path.join(rootFolderPath, '.vscode')
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
            'https://schema.manifest.build/schema.json': '**/manifest.yml'
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
      '.manifest'
    ]
    newGitignoreLines.forEach((line) => {
      if (!gitignoreContent.includes(line)) {
        gitignoreContent += `\n${line}`
      }
    })

    fs.writeFileSync(gitignorePath, gitignoreContent)

    spinner.succeed()

    // * 9. Add a README.md file if it doesn't exist.
    const readmeFilePath = path.join(rootFolderPath, 'README.md')
    if (!fs.existsSync(readmeFilePath)) {
      fs.writeFileSync(
        readmeFilePath,
        fs.readFileSync(path.join(assetFolderPath, 'README.md'), 'utf8')
      )
    }

    if (isMonorepo) {
      // If it's a monorepo, create a README.md file in the web folder and api folder (in addition to the root folder).
      const webReadmeFilePath = path.join(rootFolderPath, 'web', 'README.md')
      fs.writeFileSync(
        webReadmeFilePath,
        fs.readFileSync(path.join(assetFolderPath, 'web-readme.md'), 'utf8')
      )
      const apiReadmeFilePath = path.join(rootFolderPath, 'api', 'README.md')
      fs.writeFileSync(
        apiReadmeFilePath,
        fs.readFileSync(path.join(assetFolderPath, 'api-readme.md'), 'utf8')
      )
    }

    // * 10. Add optional files based on flags
    // Add rules for IDEs.
    if (flags.cursor) {
      spinner.start('Adding rules for Cursor IDE...')

      const cursorFolderPath = path.join(rootFolderPath, '.cursor', 'rules')
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

      const copilotFolderPath = path.join(rootFolderPath, '.github')
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

      const windsurfFolderPath = path.join(rootFolderPath, '.windsurf', 'rules')
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
      await execInDirectory(`npm install --silent`, projectName)
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

    let serverProcess: ChildProcess | null = null

    try {
      // We run the manifest script to build the database in the background
      serverProcess = spawnInDirectory('npm', ['run', 'start'], projectName)

      // Wait for the server to be ready
      await this.waitForServerToBeReady()
      spinner.succeed()
    } catch (error) {
      spinner.fail(`Execution error: ${error}`)
      // If server failed to start, try to kill it
      if (serverProcess && serverProcess.pid) {
        try {
          await this.silentKill(serverProcess.pid)
        } catch {
          // Ignore errors when killing the process
        }
      }
      throw error
    }

    spinner.start('Seeding initial data...')
    try {
      await execInDirectory(`npm run seed`, projectName)
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
    console.log(chalk.bold('  npm run start'))
    console.log()

    // Kill the background server process if it exists
    if (serverProcess && serverProcess.pid) {
      try {
        await this.silentKill(serverProcess.pid)
      } catch {
        // Ignore errors when killing the process
      }
    }

    process.exit()
  }

  /**
   * Check if the server is ready.
   *
   * @returns {Promise<boolean>} - Returns a promise that resolves to a boolean.
   *
   **/
  async isServerReady(): Promise<boolean> {
    try {
      const response = await axios.get('http://localhost:1111/api/health', {
        timeout: 5000 // 5 second timeout
      })
      return response.status === 200
    } catch {
      // Server is not ready yet
      return false
    }
  }

  /**
   * Wait for the server to be ready.
   *
   * @returns a promise that resolves to void when the server is ready.
   *
   **/
  async waitForServerToBeReady(): Promise<void> {
    let serverReady = false
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout

    while (!serverReady && attempts < maxAttempts) {
      serverReady = await this.isServerReady()
      if (!serverReady) {
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1s before retrying
      }
    }

    if (!serverReady) {
      throw new Error('Server failed to start within 30 seconds')
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
