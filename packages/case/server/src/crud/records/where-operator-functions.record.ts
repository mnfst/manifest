import { WhereOperator } from '@casejs/types'
import {
  Equal,
  In,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual
} from 'typeorm'

/**
 * Record that matches WhereOperator with related TypeORM operator function.
 */
export const whereOperatorFunctionsRecord: Record<WhereOperator, Function> = {
  [WhereOperator.Equal]: Equal,
  [WhereOperator.GreaterThan]: MoreThan,
  [WhereOperator.GreaterThanOrEqual]: MoreThanOrEqual,
  [WhereOperator.LessThan]: LessThan,
  [WhereOperator.LessThanOrEqual]: LessThanOrEqual,
  [WhereOperator.Like]: Like,
  [WhereOperator.In]: In
}
