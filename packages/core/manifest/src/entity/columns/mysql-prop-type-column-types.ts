import { PropType } from '@repo/types'
import { ColumnType } from 'typeorm'

// This is a mapping of prop types to column types in MySQL.
export const mysqlPropTypeColumnTypes: Record<PropType, ColumnType> = {
  [PropType.String]: 'varchar',
  [PropType.Number]: 'decimal',
  [PropType.Link]: 'varchar',
  [PropType.Text]: 'text',
  [PropType.RichText]: 'text',
  [PropType.Money]: 'decimal',
  [PropType.Date]: 'date',
  [PropType.Timestamp]: 'datetime',
  [PropType.Email]: 'varchar',
  [PropType.Boolean]: 'tinyint',
  [PropType.Password]: 'varchar',
  [PropType.Choice]: 'varchar', // TODO: Consider Enums in MySQL. https://orkhan.gitbook.io/typeorm/docs/entities#enum-column-type
  [PropType.Location]: 'json',
  [PropType.File]: 'varchar',
  [PropType.Image]: 'json'
}
