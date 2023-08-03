import { PropertyOptions } from './property-options.interface'

export interface RelationOptions extends PropertyOptions {
  entity: any
  entitySlug?: string
}
