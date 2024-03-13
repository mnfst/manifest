import { Injectable } from '@nestjs/common'
import { PropertyManifest } from '../../../manifest/typescript/manifest-types'
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
    // TODO: Add support for faker functions.
    return propTypeSeedFunctions[propertyManifest.type]()
  }
}
