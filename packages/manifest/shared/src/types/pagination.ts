/**
 * Generic pagination types inspired by Laravel's Paginator.
 * Used across all paginated API responses.
 */

/**
 * Generic paginated response wrapper.
 * Every paginated endpoint returns this shape (or an extension of it).
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Common query parameters for paginated endpoints.
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
} as const;
