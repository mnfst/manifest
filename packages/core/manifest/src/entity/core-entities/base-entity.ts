import { EntitySchemaColumnOptions } from 'typeorm'
import { BaseEntity } from '../types/base-entity.interface'

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
    createDate: true
  },
  updatedAt: {
    name: 'updatedAt',
    type: 'date',
    updateDate: true
  }
}
