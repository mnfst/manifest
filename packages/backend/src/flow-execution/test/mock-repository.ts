/**
 * Mock TypeORM Repository factory for FlowExecution module tests
 *
 * Usage:
 *   import { createMockRepository, MockRepository } from './test/mock-repository';
 *
 *   const mockRepository = createMockRepository();
 *   mockRepository.findOne.mockResolvedValue(mockEntity);
 */

import type { Repository, UpdateResult } from 'typeorm';
import type { FlowExecutionEntity } from '../flow-execution.entity';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T = FlowExecutionEntity> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Creates a mock TypeORM Repository for FlowExecutionEntity
 * All methods return jest.fn() mocks that can be configured per test
 */
export function createMockRepository<
  T = FlowExecutionEntity,
>(): MockRepository<T> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

/**
 * Creates a mock UpdateResult for repository.update() calls
 */
export function createMockUpdateResult(affected: number = 0): UpdateResult {
  return {
    raw: [],
    affected,
    generatedMaps: [],
  };
}
