import { PropType } from '../enums/prop-type.enum'
import { PropertyOptions } from './property-options/property-options.interface'

export interface PropertyDescription {
  propName: string
  label: string
  type: PropType
  options?: PropertyOptions | any
}
