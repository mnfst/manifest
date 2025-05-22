import * as fs from 'node:fs'

export const getBackendFileContent = async (
  localPath: string,
  remotePath?: string
): Promise<string> => {
  // We use local default example backend file if remotePath is not provided.
  if (!remotePath) {
    return Promise.resolve(fs.readFileSync(localPath, 'utf8'))
  } else {
    try {
      const response = await fetch(remotePath)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const yamlContent = await response.text()
      return yamlContent
    } catch (error) {
      console.error('Error fetching YAML:', error)
      throw error
    }
  }
}
