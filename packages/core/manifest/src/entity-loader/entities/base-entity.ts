import { EntitySchemaColumnOptions } from 'typeorm'

export const baseEntity: { [key: string]: EntitySchemaColumnOptions } = {
  id: {
    type: Number,
    primary: true,
    generated: true
  },
  createdAt: {
    name: 'created_at',
    type: 'date',
    createDate: true
  },
  updatedAt: {
    name: 'updated_at',
    type: 'date',
    updateDate: true
  }
}
