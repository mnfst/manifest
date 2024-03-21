import { Injectable } from '@nestjs/common'
import { PropertyManifest } from '../../../manifest/typescript/other/property-manifest.type'
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
  getSeedValue(propertyManifest: PropertyManifest): any {
    return propTypeSeedFunctions[propertyManifest.type]()
  }
}
