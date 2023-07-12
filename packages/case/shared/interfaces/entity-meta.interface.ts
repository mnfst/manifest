import { EntityDefinition } from './entity-definition.interface'
import { PropertyDescription } from './property-description.interface'

export interface EntityMeta {
  className: string
  definition: EntityDefinition
  props: PropertyDescription[]
}
