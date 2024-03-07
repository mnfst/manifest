import { PropType } from '@casejs/types'
import { Injectable } from '@nestjs/common'
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import { baseEntity } from '../../entities/base-entity'
import { propTypeCharacteristicsRecord } from '../../records/prop-type-characteristics.record'

@Injectable()
export class EntityLoaderService {
  constructor(private manifestService: ManifestService) {}

  /**
   * Load entities from YML file and convert into TypeORM entities.
   *
   * @returns Entity[] - Array of entities
   *
   **/
  loadEntities() {
    const manifestEntities: {
      [key: string]: {
        properties: {
          [key: string]: { type: PropType }
        }
      }
    } = this.manifestService.loadEntities()

    const entities: EntitySchema[] = Object.entries(manifestEntities).map(
      ([name, description]) => {
        const entity = new EntitySchema({
          name,
          columns: Object.entries(description.properties).reduce(
            (
              acc: any,
              [propName, propDescription]: [string, { type: PropType }]
            ) => {
              acc[propName] = {
                name: propName,
                type: propTypeCharacteristicsRecord[propDescription.type]
                  .columnType
              } as EntitySchemaColumnOptions

              return acc
            },
            { ...baseEntity }
          )
        })

        return entity
      }
    )

    return entities
  }
}
