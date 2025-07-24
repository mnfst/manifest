import { Injectable } from '@nestjs/common'
import {
  EntitySchema,
  PropertyManifest,
  PropertySchema,
  PropType,
  ValidationManifest
} from '@repo/types'
import { DEFAULT_IMAGE_SIZES } from '../../constants'

@Injectable()
export class PropertyManifestService {
  /**
   *
   * Transform  PropertySchema into a PropertyManifest.
   *
   * @param propSchema the property schema.
   * @param entitySchema the entity schema to which the property belongs.
   *
   *
   * @returns the property with the short form properties transformed into long form.
   *
   */
  transformPropertyManifest(
    propSchema: PropertySchema,
    entitySchema?: EntitySchema
  ): PropertyManifest {
    // Short syntax.
    if (typeof propSchema === 'string') {
      return {
        name: propSchema,
        type: PropType.String,
        hidden: false,
        validation:
          (entitySchema?.validation?.[propSchema] as ValidationManifest) || {}
      }
    }

    return {
      name: propSchema.name,
      type: (propSchema.type as PropType) || PropType.String,
      hidden: propSchema.hidden || false,
      options:
        propSchema.options ||
        (propSchema.type === PropType.Image
          ? { sizes: DEFAULT_IMAGE_SIZES }
          : {}),
      validation: Object.assign(
        (entitySchema?.validation?.[propSchema.name] as ValidationManifest) ||
          {},
        propSchema.validation
      ),
      helpText: propSchema.helpText || '',
      default: propSchema.default
    }
  }
}
