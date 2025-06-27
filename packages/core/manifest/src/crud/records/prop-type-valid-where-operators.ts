import { PropType, WhereOperator } from '../../../../types/src'

export const PROP_TYPE_VALID_WHERE_OPERATORS: Record<
  PropType,
  WhereOperator[]
> = {
  // String-like types: support equality, inequality, pattern matching, and set operations
  [PropType.String]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.Like,
    WhereOperator.In
  ],

  [PropType.Text]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.Like,
    WhereOperator.In
  ],

  [PropType.RichText]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.Like,
    WhereOperator.In
  ],

  [PropType.Email]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.Like,
    WhereOperator.In
  ],

  [PropType.Link]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.Like,
    WhereOperator.In
  ],

  // Numeric types: support all comparison and set operations
  [PropType.Number]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.GreaterThan,
    WhereOperator.GreaterThanOrEqual,
    WhereOperator.LessThan,
    WhereOperator.LessThanOrEqual,
    WhereOperator.In
  ],

  [PropType.Money]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.GreaterThan,
    WhereOperator.GreaterThanOrEqual,
    WhereOperator.LessThan,
    WhereOperator.LessThanOrEqual,
    WhereOperator.In
  ],

  // Date/time types: support all comparison and set operations
  [PropType.Date]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.GreaterThan,
    WhereOperator.GreaterThanOrEqual,
    WhereOperator.LessThan,
    WhereOperator.LessThanOrEqual,
    WhereOperator.In
  ],

  [PropType.Timestamp]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.GreaterThan,
    WhereOperator.GreaterThanOrEqual,
    WhereOperator.LessThan,
    WhereOperator.LessThanOrEqual,
    WhereOperator.In
  ],

  // Boolean: only equality operations make sense
  [PropType.Boolean]: [WhereOperator.Equal, WhereOperator.NotEqual],

  // Choice: equality and set operations (common for enums/select fields)
  [PropType.Choice]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.In
  ],

  // Location: equality and set operations (lat/lng coordinates or location IDs)
  [PropType.Location]: [WhereOperator.Equal, WhereOperator.NotEqual],

  // File/Image: typically filtered by filename, type, or ID
  [PropType.File]: [
    WhereOperator.Equal,
    WhereOperator.NotEqual,
    WhereOperator.Like, // for filename pattern matching
    WhereOperator.In
  ],

  [PropType.Image]: [],
  [PropType.Password]: []
}

// Helper function to check if a combination is valid
export function isValidWhereOperator(
  propType: PropType,
  operator: WhereOperator
): boolean {
  return PROP_TYPE_VALID_WHERE_OPERATORS[propType].includes(operator)
}

// Helper function to get valid operators for a property type
export function getValidWhereOperators(propType: PropType): WhereOperator[] {
  return PROP_TYPE_VALID_WHERE_OPERATORS[propType]
}
