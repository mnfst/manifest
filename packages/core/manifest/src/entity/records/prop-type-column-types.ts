import { PropType } from '@manifest-yml/types'
import { ColumnType } from 'typeorm'

export const propTypeColumnTypes: Record<PropType, ColumnType> = {
  [PropType.String]: 'varchar',
  [PropType.Number]: 'decimal',
  [PropType.Link]: 'varchar',
  [PropType.Text]: 'text',
  [PropType.Money]: 'decimal',
  [PropType.Date]: 'date',
  [PropType.Email]: 'varchar',
  [PropType.Boolean]: 'boolean',
  [PropType.Password]: 'varchar',
  [PropType.Choice]: 'simple-enum',
  [PropType.Location]: 'json'
}
