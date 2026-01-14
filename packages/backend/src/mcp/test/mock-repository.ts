/**
 * Mock TypeORM Repository factory for MCP module tests
 *
 * Usage:
 *   import { createMockRepository, MockRepository } from './test/mock-repository';
 *
 *   const mockRepository = createMockRepository();
 *   mockRepository.findOne.mockResolvedValue(mockEntity);
 */

import type { Repository } from 'typeorm';
import type { AppEntity } from '../../app/app.entity';
import type { FlowEntity } from '../../flow/flow.entity';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Creates a mock TypeORM Repository
 * All methods return jest.fn() mocks that can be configured per test
 */
export function createMockRepository<T>(): MockRepository<T> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

/**
 * Creates a mock TypeORM Repository for AppEntity
 */
export function createMockAppRepository(): MockRepository<AppEntity> {
  return createMockRepository<AppEntity>();
}

/**
 * Creates a mock TypeORM Repository for FlowEntity
 */
export function createMockFlowRepository(): MockRepository<FlowEntity> {
  return createMockRepository<FlowEntity>();
}
