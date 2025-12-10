import { WhereKeySuffix } from './WhereKeySuffix'
import { WhereOperator } from './WhereOperator'

/**
 * Record that matches WhereOperator with related key suffix.
 */
export const whereOperatorKeySuffix: Record<WhereOperator, WhereKeySuffix> = {
  [WhereOperator.Equal]: WhereKeySuffix.Equal,
  [WhereOperator.NotEqual]: WhereKeySuffix.NotEqual,
  [WhereOperator.GreaterThan]: WhereKeySuffix.GreaterThan,
  [WhereOperator.GreaterThanOrEqual]: WhereKeySuffix.GreaterThanOrEqual,
  [WhereOperator.LessThan]: WhereKeySuffix.LessThan,
  [WhereOperator.LessThanOrEqual]: WhereKeySuffix.LessThanOrEqual,
  [WhereOperator.Like]: WhereKeySuffix.Like,
  [WhereOperator.In]: WhereKeySuffix.In
}
