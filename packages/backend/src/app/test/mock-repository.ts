/**
 * Mock TypeORM Repository factory for App module tests
 *
 * Usage:
 *   import { createMockRepository, MockRepository } from './test/mock-repository';
 *
 *   const mockRepository = createMockRepository();
 *   mockRepository.findOne.mockResolvedValue(mockEntity);
 */

import type { Repository } from 'typeorm';
import type { AppEntity } from '../app.entity';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T = AppEntity> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Type for mocked query builder methods
 */
export interface MockQueryBuilder {
  loadRelationCountAndMap: jest.Mock;
  orderBy: jest.Mock;
  getMany: jest.Mock;
}

/**
 * Creates a mock SelectQueryBuilder for complex queries
 * @param getManyResult - Optional result for getMany() call
 */
export function createMockQueryBuilder(
  getManyResult: AppEntity[] = [],
): MockQueryBuilder {
  const mockQueryBuilder: MockQueryBuilder = {
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyResult),
  };
  return mockQueryBuilder;
}

/**
 * Creates a mock TypeORM Repository for AppEntity
 * All methods return jest.fn() mocks that can be configured per test
 *
 * @param queryBuilderResult - Optional entities for query builder's getMany()
 */
export function createMockRepository(
  queryBuilderResult: AppEntity[] = [],
): MockRepository<AppEntity> {
  const mockQueryBuilder = createMockQueryBuilder(queryBuilderResult);

  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };
}

/**
 * Gets the mock query builder from a mock repository
 * Useful for configuring getMany() results or verifying calls
 */
export function getMockQueryBuilder(
  mockRepository: MockRepository<AppEntity>,
): MockQueryBuilder {
  return (mockRepository.createQueryBuilder as jest.Mock)() as MockQueryBuilder;
}
