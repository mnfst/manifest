import { Command } from '@oclif/core'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

export class MyCommand extends Command {
  static description = 'description of this example command'

  async run(): Promise<void> {
    const folderName = 'case'

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
      }

      // Create a file in the folder.

      // Path to the asset file you want to copy

      const __dirname = path.dirname(fileURLToPath(import.meta.url))

      const assetFilePath = path.join(
        __dirname,
        '..',
        '..',
        'assets',
        'case.yml'
      )
      // Path where the new file should be created
      const newFilePath = path.join(folderPath, 'newFile.txt')

      // Read the content from the asset file
      const content = fs.readFileSync(assetFilePath, 'utf8')

      // Write the content to the new file
      fs.writeFileSync(newFilePath, content)
    } catch (error) {
      this.error(`Error creating folder: ${error}`)
    }
  }
}
