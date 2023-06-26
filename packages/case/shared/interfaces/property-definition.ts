import { PropType } from '../enums/prop-type.enum'

export interface PropertyDefinition {
  name?: string
  type?: PropType
  seed?: (index?: number) => any
}
