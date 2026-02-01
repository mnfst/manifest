import type { Repository, FindOptionsWhere, FindOptionsOrder } from 'typeorm';
import type { PaginatedResponse, PaginationQuery } from '@manifest/shared';
import { PAGINATION_DEFAULTS } from '@manifest/shared';

export interface PaginateOptions<Entity extends object> {
  query?: PaginationQuery;
  where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[];
  order?: FindOptionsOrder<Entity>;
}

/**
 * Generic pagination helper that wraps TypeORM's findAndCount.
 *
 * Usage:
 * ```ts
 * const result = await paginate(this.repo, {
 *   query: { page: 1, limit: 10 },
 *   where: { flowId },
 *   order: { createdAt: 'DESC' },
 * });
 * ```
 */
export async function paginate<Entity extends object>(
  repository: Repository<Entity>,
  options: PaginateOptions<Entity> = {},
): Promise<PaginatedResponse<Entity>> {
  const page = options.query?.page ?? PAGINATION_DEFAULTS.page;
  const limit = options.query?.limit ?? PAGINATION_DEFAULTS.limit;
  const skip = (page - 1) * limit;

  const [items, total] = await repository.findAndCount({
    where: options.where,
    order: options.order,
    skip,
    take: limit,
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
