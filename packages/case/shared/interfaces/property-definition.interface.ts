import { PropType } from '../enums/prop-type.enum'
import { CurrencyOptions } from './property-options/currency-options.interface'
import { PropertyOptions } from './property-options/property-options.interface'
import { RelationOptions } from './property-options/relation-options.interface'

/**
 * Defines a property of an entity.
 *
 * @interface PropertyDefinition
 */
export interface PropertyDefinition {
  label?: string

  type?: PropType

  seed?: (index?: number) => any

  /** Options for the property (related to Type) */
  options?: PropertyOptions | RelationOptions | CurrencyOptions

  typeORMOptions?: any
}
