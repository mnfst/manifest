import { BaseEntity } from '@repo/types'
import { EntitySchemaColumnOptions } from 'typeorm'

// This is a base entity that all entities extend from.
export const baseEntity: {
  [key in keyof BaseEntity]: EntitySchemaColumnOptions
} = {
  id: {
    type: Number,
    primary: true,
    generated: true
  },
  createdAt: {
    name: 'createdAt',
    type: 'date',
    createDate: true,
    select: false
  },
  updatedAt: {
    name: 'updatedAt',
    type: 'date',
    updateDate: true,
    select: false
  }
}
