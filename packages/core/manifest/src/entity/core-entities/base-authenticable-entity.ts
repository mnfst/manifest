import { AuthenticableEntity } from '@repo/types'
import { EntitySchemaColumnOptions } from 'typeorm'
import { baseEntity } from './base-entity'

// All authenticable entities extend from this entity.
export const baseAuthenticableEntity: {
  [key in keyof AuthenticableEntity]: EntitySchemaColumnOptions
} = Object.assign(
  {
    email: {
      type: 'varchar',
      unique: true
    },
    password: {
      type: 'varchar',
      select: false
    }
  },
  baseEntity
) as { [key in keyof AuthenticableEntity]: EntitySchemaColumnOptions }
