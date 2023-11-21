/**
 * Available where operators for filtering.
 */
export enum WhereOperator {
  Equal = '=',
  GreaterThan = '>',
  GreaterThanOrEqual = '>=',
  LessThan = '<',
  LessThanOrEqual = '<=',
  Like = 'like',
  In = 'in'
}

/**
 * Query params key suffix for filtering
 */
export enum WhereKeySuffix {
  Equal = '_eq',
  GreaterThan = '_gt',
  GreaterThanOrEqual = '_gte',
  LessThan = '_lt',
  LessThanOrEqual = '_lte',
  Like = '_like',
  In = '_in'
}

/**
 * Record that matches WhereOperator with related key suffix.
 */
export const whereOperatorKeySuffix: Record<WhereOperator, WhereKeySuffix> = {
  [WhereOperator.Equal]: WhereKeySuffix.Equal,
  [WhereOperator.GreaterThan]: WhereKeySuffix.GreaterThan,
  [WhereOperator.GreaterThanOrEqual]: WhereKeySuffix.GreaterThanOrEqual,
  [WhereOperator.LessThan]: WhereKeySuffix.LessThan,
  [WhereOperator.LessThanOrEqual]: WhereKeySuffix.LessThanOrEqual,
  [WhereOperator.Like]: WhereKeySuffix.Like,
  [WhereOperator.In]: WhereKeySuffix.In
}

/**
 * Paginator interface when getting paginated lists.
 */
export interface Paginator<T> {
  data: T[]
  currentPage: number
  lastPage: number
  from: number
  to: number
  total: number
  perPage: number
}
