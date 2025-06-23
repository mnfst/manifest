import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import {
  AppManifest,
  EntityManifest,
  PropertyManifest,
  PropType
} from '../../../../types/src'
import { propTypeTsType } from '../types/prop-type-ts-type'

@Injectable()
export class EntityTypeService {
  constructor(private readonly manifestService: ManifestService) {}
  /**
   * Generates the entity types based on the application manifest.
   *

   * @returns An array of EntityTypeInfo objects representing the entity types.
   */
  generateEntityTypes(): string[] {
    const appManifest: AppManifest = this.manifestService.getAppManifest()

    return Object.values(appManifest.entities).map((entity) =>
      this.generateTSInterfaceFromEntityManifest(entity)
    )
  }

  /**
   * Generates a TypeScript interface from an EntityManifest.
   *
   * @param entityManifest The EntityManifest to generate the interface from.
   * @returns A string representing the TypeScript interface.
   */
  private generateTSInterfaceFromEntityManifest(
    entityManifest: EntityManifest
  ): string {
    const idProperty: PropertyManifest = {
      name: 'id',
      type: PropType.String
    }

    const properties = [idProperty, ...entityManifest.properties]
      .map((prop: PropertyManifest) => {
        let tsType: string
        if (prop.type === PropType.Choice && prop.options?.values) {
          const values = prop.options.values as string[]
          tsType = values.map((val) => `'${val}'`).join(' | ')
        } else {
          tsType = propTypeTsType[prop.type]
        }

        return `  ${prop.name}: ${tsType};`
      })
      .join('\n')

    return `export interface ${entityManifest.className} {\n${properties}\n}\n`
  }
}
