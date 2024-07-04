import { AuthenticableEntity } from '@mnfst/types'
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm'
import { baseAuthenticableEntity } from './base-athenticable-entity'

export const AdminEntitySchema: EntitySchema = new EntitySchema({
  name: 'Admin',
  columns: baseAuthenticableEntity as {
    [key in keyof AuthenticableEntity]: EntitySchemaColumnOptions
  }
})
