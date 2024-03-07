import { EntitySchemaColumnOptions } from 'typeorm'

export const baseEntity: { [key: string]: EntitySchemaColumnOptions } = {
  id: {
    type: Number,
    primary: true,
    generated: true
  } as EntitySchemaColumnOptions,
  createdAt: {
    name: 'created_at',
    type: 'date',
    createDate: true
  } as EntitySchemaColumnOptions,
  updatedAt: {
    name: 'updated_at',
    type: 'date',
    updateDate: true
  } as EntitySchemaColumnOptions
}
