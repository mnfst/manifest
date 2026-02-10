/**
 * Mock TypeORM Repository factory for Analytics module tests
 *
 * Usage:
 *   import { createMockQueryBuilder, createMockRepository } from './test/mock-repository';
 */

import type { Repository } from 'typeorm';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Type for mocked query builder
 */
export type MockQueryBuilder = {
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  orderBy: jest.Mock;
  getRawOne: jest.Mock;
  getRawMany: jest.Mock;
};

/**
 * Creates a mock TypeORM QueryBuilder for testing analytics queries
 */
export function createMockQueryBuilder(): MockQueryBuilder {
  const mockQueryBuilder: MockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  return mockQueryBuilder;
}

/**
 * Creates a mock repository with createQueryBuilder
 */
export function createMockRepository<T>(): MockRepository<T> & {
  createQueryBuilder: jest.Mock;
} {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

/**
 * Creates a mock execution metrics result
 */
export function createMockMetricsResult(
  overrides: Partial<{ total: string; fulfilled: string; avgDuration: string }> = {},
) {
  return {
    total: overrides.total ?? '100',
    fulfilled: overrides.fulfilled ?? '85',
    avgDuration: overrides.avgDuration ?? '1500.5',
  };
}

/**
 * Creates mock chart data results
 */
export function createMockChartResults(
  buckets: { bucket: string; executions: string }[] = [],
) {
  return buckets;
}
