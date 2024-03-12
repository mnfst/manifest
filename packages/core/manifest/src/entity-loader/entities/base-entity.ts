import { EntitySchemaColumnOptions } from 'typeorm'

export const baseEntity: { [key: string]: EntitySchemaColumnOptions } = {
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
