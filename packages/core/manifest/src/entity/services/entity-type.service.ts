import { Injectable } from '@nestjs/common'
import { ManifestService } from '../../manifest/services/manifest.service'
import { AppManifest } from '../../../../types/src'

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

    return ['type 1', 'type 2', 'type 3']
  }
}
