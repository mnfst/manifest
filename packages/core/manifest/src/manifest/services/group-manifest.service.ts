import { Injectable } from '@nestjs/common'
import { GroupManifest, GroupSchema } from '../../../../types/src'
import { PropertyManifestService } from './property-manifest.service'
import pluralize from 'pluralize'

@Injectable()
export class GroupManifestService {
  constructor(
    private readonly propertyManifestService: PropertyManifestService
  ) {}

  transformGroupManifests(groupSchemaObject: {
    [key: string]: GroupSchema
  }): GroupManifest[] {
    return Object.entries(groupSchemaObject).map(
      ([className, schema]: [string, GroupSchema]) => ({
        className,
        nameSingular: pluralize.singular(className).toLowerCase(),
        properties: schema.properties.map((property) =>
          this.propertyManifestService.transformPropertyManifest(property)
        )
      })
    )
  }
}
