import { AuthenticableEntity } from '@mnfst/types'
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm'
import { baseEntity } from './base-entity'

export const AdminEntitySchema: EntitySchema = new EntitySchema({
  name: 'Admin',
  columns: Object.assign(
    {
      email: {
        type: 'varchar'
      },
      password: {
        type: 'varchar',
        select: false
      }
    },
    baseEntity
  ) as { [key in keyof AuthenticableEntity]: EntitySchemaColumnOptions }
})
