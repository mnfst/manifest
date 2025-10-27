import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { Manifest } from '@repo/types'
import { StorageService } from '../../storage/services/storage.service'
import { ConfigService } from '@nestjs/config'
import { EMPTY_MANIFEST_NAME } from '../../constants'

@Injectable()
export class YamlService {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {}

  /**
   *
   * Load the manifest from the YAML file, transform it into a Manifest object and store it in the service.
   *
   * @param manifestFilePath the path to the manifest file
   *
   * @returns void
   *
   **/
  async load({
    manifestFilePath,
    manifestFileContent
  }: {
    manifestFilePath?: string
    manifestFileContent?: string
  }): Promise<Manifest> {
    if (!manifestFileContent && !manifestFilePath) {
      throw new Error(
        'Either manifestFilePath or manifestFileContent must be provided'
      )
    }

    let fileContent: string =
      manifestFileContent || (await this.loadFileContent(manifestFilePath))

    if (fileContent === null) {
      fileContent = `name: ${EMPTY_MANIFEST_NAME}`
    }

    const manifestSchema: Manifest = yaml.load(fileContent) as Manifest

    // Remove emojis from entity keys.
    Object.keys(manifestSchema.entities || []).forEach((key) => {
      const newKey: string = this.ignoreEmojis(key)

      if (newKey !== key) {
        manifestSchema.entities[newKey] = manifestSchema.entities[key]
        delete manifestSchema.entities[key]
      }
    })

    return manifestSchema
  }

  async loadFileContent(manifestFilePath: string): Promise<string | null> {
    let fileContent: string

    if (manifestFilePath.startsWith('http')) {
      fileContent = await this.loadManifestFromUrl(manifestFilePath)
    } else {
      try {
        fileContent = fs.readFileSync(manifestFilePath, 'utf8')
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null
        }
        throw error
      }
    }

    fileContent = this.interpolateDotEnvVariables(fileContent)

    return fileContent
  }

  /**
   *
   * Save the manifest file content to the given path. Either content in YAML or manifest object must be provided.
   *
   * @param manifestFilePath
   * @param content string
   * @param manifestSchema: Manifest
   *
   * @returns { success: boolean }
   *
   **/
  async saveFileContent(
    manifestFilePath: string,
    { content, manifestSchema }: { content?: string; manifestSchema?: Manifest }
  ): Promise<{ success: boolean }> {
    if (!content && !manifestSchema) {
      throw new Error('Either content or manifest must be provided')
    }

    if (!content && manifestSchema) {
      // Convert manifest object to YAML string and format it.
      content = yaml.dump(manifestSchema, {
        indent: 2,
        flowLevel: 4, // Only objects at depth 4+ use inline syntax
        lineWidth: -1,
        noRefs: true
      })
    }

    if (manifestFilePath.startsWith('http')) {
      this.storageService.uploadToS3(
        this.configService.get('storage').s3ManifestFilePath,
        Buffer.from(content, 'utf8')
      )
    } else {
      fs.writeFileSync(manifestFilePath, content, 'utf8')
    }

    return { success: true }
  }

  /**
   *
   * Load the manifest from a URL.
   *
   * @param url
   * @returns string the file content
   *
   **/
  async loadManifestFromUrl(url: string): Promise<string> {
    const response = await fetch(url).catch(() => {
      throw new Error(`Failed to fetch the manifest from ${url}`)
    })

    const text = await response.text()

    return text
  }

  /**
   *
   * Ignore emojis from the file content. Also remove the optional space before or after the emoji if it exists.
   *
   * @param fileContent
   * @returns string the file content without emojis
   */
  ignoreEmojis(fileContent: string): string {
    const emojiWithSurroundingSpacesRegex =
      /\s?[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2E00}-\u{2E7F}\u{3000}-\u{303F}\u{FE00}-\u{FE0F}](\s?)/gu

    return (fileContent || '')
      .replace(emojiWithSurroundingSpacesRegex, '')
      .replace(/[^\w]/g, '')
      .trim()
  }

  /**
   * Interpolates environment variables in a YAML string.
   *
   * @param {string} yamlContent - The YAML content with placeholders.
   * @returns {string} - The YAML content with placeholders replaced by environment variables.
   */
  interpolateDotEnvVariables(yamlContent: string): string {
    return yamlContent.replace(/\$\{\s*(\w+)\s*}/g, (match, varName) => {
      const value = process.env[varName]
      if (value === undefined) {
        console.warn(`Warning: Environment variable ${varName} is not defined.`)
      }
      return value || match
    })
  }
}
