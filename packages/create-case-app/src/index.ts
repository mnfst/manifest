import { Command } from '@oclif/core'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { updatePackageJsonFile } from './utils/UpdatePackageJsonFile.js'

export class MyCommand extends Command {
  static description = 'description of this example command'

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
    } catch (error) {
      this.error(`Error creating folder: ${error}`)
    }
  }
}
