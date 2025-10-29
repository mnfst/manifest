import { PropType } from '@repo/types'

/**
 * Lists all available options keys for each property type. If a property type is not listed, it has no options.
 */
export const propTypeOptionsRecord: Partial<Record<PropType, string[]>> = {
  [PropType.Image]: ['sizes'],
  [PropType.Choice]: ['values', 'sequential'],
  [PropType.Money]: ['currency']
}
