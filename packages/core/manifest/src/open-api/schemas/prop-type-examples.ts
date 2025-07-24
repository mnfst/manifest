/**
 * This is a mapping of property types to real-world examples.
 * It is used to provide example values for entity properties in OpenAPI schemas.
 */
import { PropType } from '../../../../types/src'
export const propTypeExamples: Record<PropType, unknown> = {
  [PropType.String]: 'This is a simple string example.',
  [PropType.Text]:
    'This is a longer text example that might span multiple lines and contain more detailed information.',
  [PropType.RichText]:
    '<p>This is <strong>rich text</strong> with <em>HTML formatting</em> and <a href="https://example.com">links</a>.</p>',
  [PropType.Number]: 42,
  [PropType.Link]: 'https://example.com',
  [PropType.Money]: 99.99,
  [PropType.Date]: '2024-01-15',
  [PropType.Timestamp]: '2024-01-15T10:30:00Z',
  [PropType.Email]: 'user@example.com',
  [PropType.Boolean]: true,
  [PropType.Password]: '********',
  [PropType.Choice]: null, // This would be overridden with actual enum values.
  [PropType.Location]: {
    lat: 45.1666,
    lng: 5.7167
  },
  [PropType.File]: 'https://example.com/uploads/documents/report.pdf',
  [PropType.Image]: null, // This would be overridden with actual image URLs or sizes.
  [PropType.Nested]: null // This would be overridden with a $reference to a group entity.
}
