import { PropType } from '@repo/types'
import { ColumnType } from 'typeorm'

// This is a mapping of prop types to column types in Postgres.
export const postgresPropTypeColumnTypes: Record<PropType, ColumnType> = {
  [PropType.String]: 'varchar',
  [PropType.Number]: 'numeric',
  [PropType.Link]: 'varchar',
  [PropType.Text]: 'text',
  [PropType.RichText]: 'text',
  [PropType.Money]: 'numeric',
  [PropType.Date]: 'date',
  [PropType.Timestamp]: 'timestamp',
  [PropType.Email]: 'varchar',
  [PropType.Boolean]: 'boolean',
  [PropType.Password]: 'varchar',
  [PropType.Choice]: 'text', // TODO: Enum should be handled separately with CREATE TYPE
  [PropType.Location]: 'jsonb',
  [PropType.File]: 'varchar',
  [PropType.Image]: 'jsonb'
}
