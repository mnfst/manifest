import { WhereOperator } from '../../../../types/src'

/**
 * Descriptions for each where operator, used in OpenAPI schemas.
 * Provides context for filtering operations in queries.
 */
export const WHERE_OPERATOR_DESCRIPTIONS: Record<
  WhereOperator,
  (entity: string, property: string) => string
> = {
  [WhereOperator.Equal]: (entity: string, property: string) =>
    `Get ${entity} where ${property} equals the specified value`,

  [WhereOperator.NotEqual]: (entity: string, property: string) =>
    `Get ${entity} where ${property} does not equal the specified value`,

  [WhereOperator.GreaterThan]: (entity: string, property: string) =>
    `Get ${entity} where ${property} is greater than the specified value`,

  [WhereOperator.GreaterThanOrEqual]: (entity: string, property: string) =>
    `Get ${entity} where ${property} is greater than or equal to the specified value`,

  [WhereOperator.LessThan]: (entity: string, property: string) =>
    `Get ${entity} where ${property} is less than the specified value`,

  [WhereOperator.LessThanOrEqual]: (entity: string, property: string) =>
    `Get ${entity} where ${property} is less than or equal to the specified value`,

  [WhereOperator.Like]: (entity: string, property: string) =>
    `Get ${entity} where ${property} contains or matches the specified pattern (use % for wildcards)`,

  [WhereOperator.In]: (entity: string, property: string) =>
    `Get ${entity} where ${property} is one of the specified values (comma-separated)`
}
