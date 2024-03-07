import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'

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
    const appManifest = this.manifestService.loadEntities()

    // Load entities from YML file

    // Validate entities against schema

    // Convert into TypeORM entities

    // Return entities

    return appManifest
  }
}
