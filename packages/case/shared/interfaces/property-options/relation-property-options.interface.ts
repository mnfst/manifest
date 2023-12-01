import { PropertyOptions } from './property-options.interface'

export interface RelationPropertyOptions extends PropertyOptions {
  /** Entity class to which the relation is made */
  entity: any // Actually should be [new () => BaseEntity] but fails in the client as BasEntity has dependencies on the server.

  /** If true, the relation will be loaded automatically when the entity is loaded */
  eager?: boolean

  /* Do not use this property. It is used internally to convert the class to string. */
  entitySlug?: string
}
