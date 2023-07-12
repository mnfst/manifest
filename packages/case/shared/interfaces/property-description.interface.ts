import { PropType } from '../enums/prop-type.enum'
import { RelationOptions } from './property-options/relation-options.interface'

export interface PropertyDescription {
  propName: string
  label: string
  type: PropType
  filter?: boolean
  options?: RelationOptions
}
