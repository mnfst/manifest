import { PropType } from '@casejs/types'
import { Injectable } from '@nestjs/common'
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import { Entity } from '../../../manifest/typescript/manifest-types'
import { baseEntity } from '../../entities/base-entity'
import { propTypeCharacteristicsRecord } from '../../records/prop-type-characteristics.record'

@Injectable()
export class EntityLoaderService {
  constructor(private manifestService: ManifestService) {}

  /**
   * Load entities from YML file and convert into TypeORM entities.
   *
   * @returns EntitySchema[] the entities
   *
   **/
  loadEntities(): EntitySchema[] {
    const manifestEntities: {
      [key: string]: Entity
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
