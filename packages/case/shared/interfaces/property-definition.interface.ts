import { PropType } from '../enums/prop-type.enum'
import { RelationOptions } from './type-settings/relation-options.interface'

/**
 * Defines a property of an entity.
 *
 * @interface PropertyDefinition
 */
export interface PropertyDefinition {
  label?: string

  type?: PropType

  seed?: (index?: number) => any

  /** Allow filtering by this property in lists */
  filter?: boolean

  options?: RelationOptions
}
