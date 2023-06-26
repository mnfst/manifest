import { PropType } from '../enums/prop-type.enum'
import { RelationSettings } from './type-settings/relation-settings.interface'

export interface PropertyDefinition {
  name?: string
  type?: PropType
  seed?: (index?: number) => any
  settings?: RelationSettings
}
