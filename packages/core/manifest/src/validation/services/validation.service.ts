import { EntityManifest } from '@mnfst/types'
import { Injectable } from '@nestjs/common'
import { ValidationError } from 'class-validator'

@Injectable()
export class ValidationService {
  /**
   *
   * Validate an item DTO against an entity manifest.
   *
   * @param itemDto The item DTO to validate.
   * @param entity The entity manifest to validate against.
   *
   * @returns A promise of an array of validation errors.
   *
   */
  async validate(
    itemDto: any,
    entity: EntityManifest
  ): Promise<ValidationError[]> {
    console.log('ValidationService.validate', itemDto, entity)

    return Promise.resolve([])
  }
}
