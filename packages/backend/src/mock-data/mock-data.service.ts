import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MockDataEntity } from './mock-data.entity';
import type {
  MockData,
  MockDataEntityDTO,
  LayoutTemplate,
} from '@chatgpt-app-builder/shared';
import {
  DEFAULT_TABLE_MOCK_DATA,
  DEFAULT_POST_LIST_MOCK_DATA,
  isTableMockData,
  isPostListMockData,
} from '@chatgpt-app-builder/shared';

/**
 * Result of mock data validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Service for MockData CRUD operations
 * Manages sample data entities for views
 */
@Injectable()
export class MockDataService {
  constructor(
    @InjectRepository(MockDataEntity)
    private readonly mockDataRepository: Repository<MockDataEntity>
  ) {}

  /**
   * Create mock data for a view with default data based on layout template
   */
  async createForView(
    viewId: string,
    layoutTemplate: LayoutTemplate
  ): Promise<MockDataEntityDTO> {
    const defaultData = this.getDefaultMockData(layoutTemplate);

    const entity = this.mockDataRepository.create({
      viewId,
      data: defaultData,
    });

    const saved = await this.mockDataRepository.save(entity);
    return this.entityToDTO(saved);
  }

  /**
   * Get mock data by ID
   */
  async findById(id: string): Promise<MockDataEntityDTO | null> {
    const entity = await this.mockDataRepository.findOne({ where: { id } });
    return entity ? this.entityToDTO(entity) : null;
  }

  /**
   * Get mock data by view ID
   */
  async findByViewId(viewId: string): Promise<MockDataEntityDTO | null> {
    const entity = await this.mockDataRepository.findOne({ where: { viewId } });
    return entity ? this.entityToDTO(entity) : null;
  }

  /**
   * Update mock data with optional validation
   */
  async update(
    id: string,
    data: MockData,
    layoutTemplate?: LayoutTemplate
  ): Promise<MockDataEntityDTO> {
    const entity = await this.mockDataRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`MockData with id ${id} not found`);
    }

    console.log('Updating mock data:', id);
    console.log('New data:', JSON.stringify(data, null, 2));

    // Validate data against layout template if provided
    let validatedData = data;
    if (layoutTemplate) {
      const validation = this.validateMockData(data, layoutTemplate);
      console.log('Validation result:', validation);
      if (!validation.valid) {
        console.warn(
          `Mock data validation failed: ${validation.error}. Using fallback.`
        );
        validatedData = this.getDefaultMockData(layoutTemplate);
      }
    }

    entity.data = validatedData;
    console.log('Saving entity with data:', JSON.stringify(entity.data, null, 2));
    const saved = await this.mockDataRepository.save(entity);
    console.log('Saved entity updatedAt:', saved.updatedAt);
    return this.entityToDTO(saved);
  }

  /**
   * Validate that mock data matches the expected layout template format
   */
  validateMockData(data: MockData, layoutTemplate: LayoutTemplate): ValidationResult {
    if (layoutTemplate === 'table') {
      if (!isTableMockData(data)) {
        return {
          valid: false,
          error: `Expected table mock data but received ${data.type}`,
        };
      }
      if (!data.columns || !Array.isArray(data.columns) || data.columns.length === 0) {
        return {
          valid: false,
          error: 'Table mock data must have at least one column',
        };
      }
      if (!data.rows || !Array.isArray(data.rows)) {
        return {
          valid: false,
          error: 'Table mock data must have rows array',
        };
      }
      return { valid: true };
    }

    if (layoutTemplate === 'post-list') {
      if (!isPostListMockData(data)) {
        return {
          valid: false,
          error: `Expected post-list mock data but received ${data.type}`,
        };
      }
      if (!data.posts || !Array.isArray(data.posts) || data.posts.length === 0) {
        return {
          valid: false,
          error: 'Post-list mock data must have at least one post',
        };
      }
      return { valid: true };
    }

    return {
      valid: false,
      error: `Unknown layout template: ${layoutTemplate}`,
    };
  }

  /**
   * Get default mock data for a layout template
   */
  getDefaultMockData(layoutTemplate: LayoutTemplate): MockData {
    switch (layoutTemplate) {
      case 'table':
        return DEFAULT_TABLE_MOCK_DATA;
      case 'post-list':
        return DEFAULT_POST_LIST_MOCK_DATA;
      default:
        return DEFAULT_TABLE_MOCK_DATA;
    }
  }

  /**
   * Convert entity to DTO
   */
  private entityToDTO(entity: MockDataEntity): MockDataEntityDTO {
    return {
      id: entity.id,
      viewId: entity.viewId,
      data: entity.data,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
