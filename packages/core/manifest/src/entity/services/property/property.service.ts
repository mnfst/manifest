import { Injectable } from '@nestjs/common'
import { DetailedPropertyManifest } from '../../../manifest/typescript/other/detailed-property-manifest.type'
import { propTypeSeedFunctions } from '../../records/prop-type-seed-functions'

@Injectable()
export class PropertyService {
  /**
   * Get the seed value for a property.
   *
   * @param propertyManifest The property manifest.
   *
   * @returns The seed value.
   *
   */
  getSeedValue(propertyManifest: DetailedPropertyManifest): any {
    return propTypeSeedFunctions[propertyManifest.type]()
  }
}
