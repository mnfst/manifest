import { PropType } from '@casejs/types'

export const propTypeColumnTypes: Record<PropType, string> = {
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
