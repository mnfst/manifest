import { PropertyOptions } from './property-options.interface'

export interface RelationPropertyOptions extends PropertyOptions {
  entity: any
  entitySlug?: string
}
