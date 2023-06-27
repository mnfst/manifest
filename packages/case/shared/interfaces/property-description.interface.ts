import { PropType } from '../enums/prop-type.enum'

export interface PropertyDescription {
  propName: string
  label: string
  type: PropType
  relatedEntity?: string
}
