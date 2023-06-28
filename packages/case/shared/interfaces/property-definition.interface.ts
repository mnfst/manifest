import { PropType } from '../enums/prop-type.enum'
import { RelationOptions } from './type-settings/relation-options.interface'

export interface PropertyDefinition {
  label?: string
  type?: PropType
  seed?: (index?: number) => any
  options?: RelationOptions
}
