/**
 * Mock TypeORM Repository factory for Schema module tests
 */

import type { Repository } from 'typeorm';
import type { FlowEntity } from '../../../flow/flow.entity';

/**
 * Type for mocked repository methods
 */
export type MockRepository<T = FlowEntity> = {
  [K in keyof Repository<T>]?: jest.Mock;
};

/**
 * Creates a mock TypeORM Repository for FlowEntity
 */
export function createMockFlowRepository(): MockRepository<FlowEntity> {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
  };
}
