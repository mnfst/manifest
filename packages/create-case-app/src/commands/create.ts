import { Command, ux } from '@oclif/core'
import chalk from 'chalk'
import { exec as execCp } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { updateExtensionJsonFile } from '../utils/UpdateExtensionJsonFile.js'
import { updatePackageJsonFile } from '../utils/UpdatePackageJsonFile.js'
import { updateSettingsJsonFile } from '../utils/UpdateSettingsJsonFile.js'

const exec = promisify(execCp)

export class MyCommand extends Command {
  static description = 'Adds CASE to your project.'

  /**
   * The run method is called when the command is run.
   * Steps:
   * 1. Create a folder with the name `case`.
   * 2. Create a file inside the folder with the name `case.yml`.
   * 3. Update the `package.json` file with the new packages and scripts.
   * 4. Update the .vscode/extensions.json file with the recommended extensions.
   * 5. Update the .vscode/settings.json file with the recommended settings.
   * 6. Update the .gitignore file with the recommended settings.
   * 7. Install the new packages.
   * 8. Serve the new app.
   */
  async run(): Promise<void> {
    const folderName = 'case'
    const initialFileName = 'case.yml'
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const assetFolderPath = path.join(__dirname, '..', 'assets')

    try {
      ux.action.start('Adding CASE to your project...')

      // Construct the folder path. This example creates the folder in the current working directory.
      const folderPath = path.join(process.cwd(), folderName)

      // Check if the folder already exists
      if (!fs.existsSync(folderPath)) {
        // Create the folder
        fs.mkdirSync(folderPath)
        this.log(`Folder created: ${folderPath}`)
      } else {
        // This error message could be improved to take more space in terminal.
        this.log(
          chalk.redBright(`Error: Folder already exists`),
          chalk.white(
            `The ${folderName} folder already exists in the current directory. Please remove it and try again.`
          )
        )
        process.exit(1)
      }

      // Path where the new file should be created
      const newFilePath = path.join(folderPath, initialFileName)

      // Read the content from the asset file
      const content = fs.readFileSync(
        path.join(assetFolderPath, initialFileName),
        'utf8'
      )

      // Write the content to the new file
      fs.writeFileSync(newFilePath, content)

      ux.action.stop()
      ux.action.start('Updating package.json file...')

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

      // TODO: Replace the packages and scripts by the real ones.
      fs.writeFileSync(
        packagePath,
        updatePackageJsonFile({
          fileContent: packageJson,
          newPackages: {
            '@casejs/types': 'latest' // Random package.
          },
          newScripts: {
            case: 'node case.js'
          }
        })
      )

      ux.action.stop()
      ux.action.start('Adding settings...')

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
          fileContent: extensionsJson,
          newExtensions: ['redhat.vscode-yaml']
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
          newSettings: {
            'yaml.schemas': {
              'schema.json': ['case/*.yml', 'case/*.yaml']
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
      }

      if (!gitignoreContent.includes('.vscode')) {
        gitignoreContent += '\n.vscode'
      }

      fs.writeFileSync(gitignorePath, gitignoreContent)

      ux.action.stop()
      ux.action.start('Installing dependencies...')

      // Install deps.
      try {
        const { stdout, stderr } = await exec('npm install')
        if (stderr) {
          this.log(`stderr: ${stderr}`)
        }
        this.log(`stdout: ${stdout}`)
        this.log('npm install completed successfully!')
      } catch (error) {
        this.error(`Execution error: ${error}`)
      }

      //  Serve the new app.
      ux.action.stop()

      try {
        const { stdout, stderr } = await exec('npm run case')
        if (stderr) {
          this.log(`stderr: ${stderr}`)
        }
        this.log(`stdout: ${stdout}`)
        this.log('npm install completed successfully!')
      } catch (error) {
        this.error(`Execution error: ${error}`)
      }
    } catch (error) {
      this.error(`Error: ${error}`)
    }
  }
}
