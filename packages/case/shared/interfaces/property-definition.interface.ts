import { ColumnOptions } from 'typeorm'

import { PropType } from '../enums/prop-type.enum'
import { CurrencyOptions } from './property-options/currency-options.interface'
import { EnumOptions } from './property-options/enum-options.interface'
import { FileOptions } from './property-options/file-options.interface'
import { PropertyOptions } from './property-options/property-options.interface'
import { RelationOptions } from './property-options/relation-options.interface'

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
    | RelationOptions
    | CurrencyOptions
    | FileOptions
    | EnumOptions

  /** TypeORM options for the property */
  typeORMOptions?: ColumnOptions

  /** Validators for the property: https://github.com/typestack/class-validator */
  validators?: PropertyDecorator[]
}
