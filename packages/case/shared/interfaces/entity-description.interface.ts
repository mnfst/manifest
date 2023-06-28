import { EntityDefinition } from './entity-definition.interface'
import { PropertyDescription } from './property-description.interface'

export interface EntityDescription {
  className: string
  definition: EntityDefinition
  props: PropertyDescription[]
}
