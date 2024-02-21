import { Command } from '@oclif/core'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { updateExtensionJsonFile } from './utils/UpdateExtensionJsonFile.js'
import { updatePackageJsonFile } from './utils/UpdatePackageJsonFile.js'
import { updateSettingsJsonFile } from './utils/UpdateSettingsJsonFile.js'

export class MyCommand extends Command {
  static description = 'description of this example command'

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
            '@casejs/case': 'latest'
          },
          newScripts: {
            case: 'case'
          }
        })
      )

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

      // TODO: Update the .gitignore file with the recommended settings.

      // TODO: Install the new packages.

      // TODO: Serve the new app.
    } catch (error) {
      this.error(`Error running the command: ${error}`)
    }
  }
}
