/**
 * This is a mapping of Manifest property types to OpenAPI formats https://swagger.io/docs/specification/v3_0/data-models/data-types.
 */
import { PropType } from '../../../../types/src'
export const propTypeFormats: Record<PropType, string | null> = {
  [PropType.String]: null,
  [PropType.Text]: null,
  [PropType.RichText]: null,
  [PropType.Number]: 'float',
  [PropType.Link]: 'uri',
  [PropType.Money]: 'double',
  [PropType.Date]: 'date',
  [PropType.Timestamp]: 'date-time',
  [PropType.Email]: 'email',
  [PropType.Boolean]: null,
  [PropType.Password]: null,
  [PropType.Choice]: null,
  [PropType.Location]: null,
  [PropType.File]: 'uri',
  [PropType.Image]: null,
  [PropType.Group]: null
}
