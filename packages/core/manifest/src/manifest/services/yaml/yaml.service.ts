import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { ConfigService } from '@nestjs/config'
import { AppManifest } from '../../typescript/manifest-types'

@Injectable()
export class YamlService {
  yamlConfig: Object

  constructor(private configService: ConfigService) {}

  /**
   *
   * Load the manifest from the YML file and transform it into a AppManifest object.
   *
   * @returns AppManifest the manifest
   *
   **/
  load(): AppManifest {
    this.yamlConfig = this.configService.get('yaml')

    const fileContent: string = fs.readFileSync(
      `${process.cwd()}/manifest/backend.yml`,
      'utf8'
    )

    return yaml.load(fileContent) as AppManifest
  }
}
