import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { ConfigService } from '@nestjs/config'
import { MANIFEST_FILE_NAME, MANIFEST_FOLDER_NAME } from '../../../../constants'
import {
  AppManifest,
  EntityManifest,
  RelationshipManifest
} from '../../typescript/manifest-types'

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
      `${process.cwd()}/${MANIFEST_FOLDER_NAME}/${MANIFEST_FILE_NAME}`,
      'utf8'
    )

    const manifest: AppManifest = this.transform(
      yaml.load(fileContent) as AppManifest
    )

    return manifest
  }

  /**
   *
   *  Transform the short form of the manifest into the long form.
   *
   * @param manifest the manifest that can include short form properties.
   *
   * @returns the manifest with the short form properties transformed into long form.
   */
  transform(manifest: AppManifest): AppManifest {
    Object.values(manifest.entities).forEach((entity: EntityManifest) => {
      // 1 Relationships.
      if (entity.belongsTo?.length > 0) {
        entity.belongsTo.forEach((relationship: RelationshipManifest) => {
          if (typeof relationship === 'string') {
            entity.belongsTo[entity.belongsTo.indexOf(relationship)] = {
              name: relationship.toLowerCase(),
              entity: relationship
            }
          }
        })
      }
    })

    return manifest
  }
}
