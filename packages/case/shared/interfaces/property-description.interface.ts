import { PropType } from '../enums/prop-type.enum'
import { CurrencyPropertyOptions } from './property-options/currency-property-options.interface'
import { EnumPropertyOptions } from './property-options/enum-property-options.interface'
import { ImagePropertyOptions } from './property-options/image-property-options.interface'
import { PropertyOptions } from './property-options/property-options.interface'
import { RelationPropertyOptions } from './property-options/relation-property-options.interface'

export interface PropertyDescription {
  propName: string
  label: string
  type: PropType
  options?:
    | PropertyOptions
    | EnumPropertyOptions
    | CurrencyPropertyOptions
    | ImagePropertyOptions
    | RelationPropertyOptions
}
