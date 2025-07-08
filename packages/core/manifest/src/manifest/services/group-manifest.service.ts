import { Injectable } from '@nestjs/common'
import {
  EntitySchema,
  GroupManifest,
  GroupSchema,
  Manifest,
  PropertySchema,
  RelationshipManifest
} from '@repo/types'
import { PropertyManifestService } from './property-manifest.service'
import pluralize from 'pluralize'
import { camelize } from '../../../../common/src'

@Injectable()
export class GroupManifestService {
  constructor(
    private readonly propertyManifestService: PropertyManifestService
  ) {}

  transformGroupManifests(appSchema: Manifest): GroupManifest[] {
    return Object.entries(appSchema.groups).map(
      ([className, schema]: [string, GroupSchema]) => {
        const relationships: RelationshipManifest[] = []

        Object.entries(appSchema.entities || {}).forEach(
          ([entityClassName, entitySchema]: [string, EntitySchema]) => {
            entitySchema.properties.forEach((property: PropertySchema) => {
              if (
                property['type'] === 'group' &&
                property['options']?.group === className
              ) {
                relationships.push({
                  name: camelize(entityClassName),
                  entity: entityClassName,
                  type: 'many-to-one'
                })
              }
            })
          }
        )

        return {
          className,
          nameSingular: pluralize.singular(className).toLowerCase(),
          properties: schema.properties.map((property) =>
            this.propertyManifestService.transformPropertyManifest(property)
          ),
          relationships
        }
      }
    )
  }
}
