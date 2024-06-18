import { EntityManifest } from '@mnfst/types'
import { Injectable } from '@nestjs/common'
import { PathItemObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

@Injectable()
export class OpenApiCrudService {
  generateEntityPaths(entityManifest: EntityManifest): PathItemObject[] {}

  generateListPath(entityManifest: EntityManifest): PathItemObject {}

  generateListSelectOptionsPath(
    entityManifest: EntityManifest
  ): PathItemObject {}

  generateCreatePath(entityManifest: EntityManifest): PathItemObject {}

  generateDetailPath(entityManifest: EntityManifest): PathItemObject {}

  generateUpdatePath(entityManifest: EntityManifest): PathItemObject {}

  generateDeletePath(entityManifest: EntityManifest): PathItemObject {}
}
