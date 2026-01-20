/**
 * Mock TypeORM Repository factory for Node module tests
 *
 * Usage:
 *   import { createMockFlowRepository, MockRepository } from './test/mock-repository';
 *
 *   const mockRepository = createMockFlowRepository();
 *   mockRepository.findOne.mockResolvedValue(mockEntity);
 */

import type { Repository } from 'typeorm';
import type { FlowEntity } from '../../flow/flow.entity';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T = FlowEntity> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Creates a mock TypeORM Repository for FlowEntity (used by NodeService)
 * All methods return jest.fn() mocks that can be configured per test
 */
export function createMockFlowRepository(): MockRepository<FlowEntity> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };
}
