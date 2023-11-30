import { ColumnOptions } from 'typeorm'

import { PropType } from '../enums/prop-type.enum'
import { CurrencyPropertyOptions } from './property-options/currency-property-options.interface'
import { EnumPropertyOptions } from './property-options/enum-property-options.interface'
import { ImagePropertyOptions } from './property-options/image-property-options.interface'
import { PropertyOptions } from './property-options/property-options.interface'
import { RelationPropertyOptions } from './property-options/relation-property-options.interface'

/**
 * Defines a property of an entity.
 *
 * @interface PropertyDefinition
 */
export interface PropertyDefinition {
  /** Label of the property. If blank the propName will be used as label */
  label?: string

  /** Type of the property */
  type?: PropType

  seed?: (index?: number) => any

  /** Options for the property (related to Type) */
  options?:
    | PropertyOptions
    | RelationPropertyOptions
    | CurrencyPropertyOptions
    | EnumPropertyOptions
    | ImagePropertyOptions

  /** TypeORM options for the property */
  typeORMOptions?: ColumnOptions

  /** Validators for the property: https://github.com/typestack/class-validator */
  validators?: PropertyDecorator[]
}
