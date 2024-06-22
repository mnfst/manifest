import { PropType } from '@mnfst/types'
import { ColumnType } from 'typeorm'

// This is a mapping of prop types to column types in sqlite.
export const propTypeColumnTypes: Record<PropType, ColumnType> = {
  [PropType.String]: 'varchar',
  [PropType.Number]: 'decimal',
  [PropType.Link]: 'varchar',
  [PropType.Text]: 'text',
  [PropType.Money]: 'decimal',
  [PropType.Date]: 'date',
  [PropType.Timestamp]: 'text',
  [PropType.Email]: 'varchar',
  [PropType.Boolean]: 'boolean',
  [PropType.Password]: 'varchar',
  [PropType.Choice]: 'simple-enum',
  [PropType.Location]: 'json'
}
