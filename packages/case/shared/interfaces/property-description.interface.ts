import { PropType } from '../enums/prop-type.enum'
import { RelationSettings } from './type-settings/relation-settings.interface'

export interface PropertyDescription {
  propName: string
  label: string
  type: PropType
  settings?: RelationSettings
}
