import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { AppManifestSchema } from '@casejs/types/src/manifests/manifest-types'
import { ConfigService } from '@nestjs/config'
import { MANIFEST_FILE_NAME, MANIFEST_FOLDER_NAME } from '../../../constants'

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
  load(): AppManifestSchema {
    this.yamlConfig = this.configService.get('yaml')

    const fileContent: string = fs.readFileSync(
      `${process.cwd()}/${MANIFEST_FOLDER_NAME}/${MANIFEST_FILE_NAME}`,
      'utf8'
    )

    return yaml.load(fileContent) as AppManifestSchema
  }
}
