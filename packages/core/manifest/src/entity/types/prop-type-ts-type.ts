import { PropType } from '../../../../types/src'
import { TsType } from './ts-types'

/**
 * This is a mapping of property types to TypeScript types.
 * It is used to generate TypeScript interfaces for entity properties.
 */
export const propTypeTsType: Record<PropType, TsType> = {
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
  [PropType.Location]: '{ lat: number; lng: number }',
  [PropType.File]: 'string',
  [PropType.Image]: '{[key:string]: string}'
}
