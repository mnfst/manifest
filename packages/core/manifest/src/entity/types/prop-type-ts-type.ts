import { PropType } from '../../../../types/src'

/**
 * This is a mapping of property types to TypeScript types.
 * It is used to generate TypeScript interfaces for entity properties.
 */
export const propTypeTsType: Record<PropType, string> = {
  [PropType.String]: 'string',
  [PropType.Text]: 'string',
  [PropType.RichText]: 'string',
  [PropType.Number]: 'number',
  [PropType.Link]: 'string',
  [PropType.Money]: 'number',
  [PropType.Date]: 'Date',
  [PropType.Timestamp]: 'Date',
  [PropType.Email]: 'string',
  [PropType.Boolean]: 'boolean',
  [PropType.Password]: 'string',
  [PropType.Choice]: 'string', // Will be overridden with enum values
  [PropType.Location]: 'string',
  [PropType.File]: 'string',
  [PropType.Image]: 'string'
}
