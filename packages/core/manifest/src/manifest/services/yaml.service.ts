import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { Manifest } from '@repo/types'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class YamlService {
  constructor(private readonly configService: ConfigService) {}

  /**
   *
   * Load the manifest from the YML file and transform it into a AppManifest object.
   *
   * @returns AppManifest the manifest
   *
   **/
  load(): Manifest {
    const fileContent: string = fs.readFileSync(
      this.configService.get('paths').manifestFile,
      'utf8'
    )

    const manifest: Manifest = yaml.load(fileContent) as Manifest

    // Remove emojis from entity keys.
    Object.keys(manifest.entities).forEach((key) => {
      const newKey: string = this.ignoreEmojis(key)
      if (newKey !== key) {
        manifest.entities[newKey] = manifest.entities[key]
        delete manifest.entities[key]
      }
    })

    return manifest
  }

  /**
   *
   * Ignore emojis from the file content. Also remove the optional space before or after the emoji if it exists.
   *
   * @param fileContent
   * @returns string the file content without emojis
   *
   */
  ignoreEmojis(fileContent: string): string {
    const emojiNearDirectSpaceRegex =
      /([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2E00}-\u{2E7F}\u{3000}-\u{303F}\u{FE00}-\u{FE0F}]\s?)/gu

    return (fileContent || '').replace(emojiNearDirectSpaceRegex, '').trim()
  }
}
