import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../entities/app.entity';
import type { App, PublishResult } from '@chatgpt-app-builder/shared';

/**
 * Service for App CRUD operations
 * POC: Single-session operation - one app at a time
 */
@Injectable()
export class AppService {
  // POC: Store current session app ID in memory
  private currentAppId: string | null = null;

  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>
  ) {}

  /**
   * Create a new app and set as current session app
   */
  async create(appData: Partial<App>): Promise<App> {
    const entity = this.appRepository.create(appData);
    const saved = await this.appRepository.save(entity);
    this.currentAppId = saved.id;
    return this.entityToApp(saved);
  }

  /**
   * Get app by ID
   */
  async findById(id: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({ where: { id } });
    return entity ? this.entityToApp(entity) : null;
  }

  /**
   * Get app by MCP slug
   */
  async findBySlug(mcpSlug: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({ where: { mcpSlug } });
    return entity ? this.entityToApp(entity) : null;
  }

  /**
   * Get current session app
   */
  async getCurrentApp(): Promise<App | null> {
    if (!this.currentAppId) {
      return null;
    }
    return this.findById(this.currentAppId);
  }

  /**
   * Update an app
   */
  async update(id: string, updates: Partial<App>): Promise<App> {
    const entity = await this.appRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`App with id ${id} not found`);
    }

    Object.assign(entity, updates);
    const saved = await this.appRepository.save(entity);
    return this.entityToApp(saved);
  }

  /**
   * Publish an app to MCP server
   */
  async publish(id: string): Promise<PublishResult> {
    const entity = await this.appRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`App with id ${id} not found`);
    }

    // Validate required fields for publishing
    const errors: string[] = [];

    if (!entity.toolName || entity.toolName.length < 1) {
      errors.push('Tool name is required (1-50 characters)');
    } else if (entity.toolName.length > 50) {
      errors.push('Tool name must be 50 characters or less');
    }

    if (!entity.toolDescription || entity.toolDescription.length < 10) {
      errors.push('Tool description is required (10-500 characters)');
    } else if (entity.toolDescription.length > 500) {
      errors.push('Tool description must be 500 characters or less');
    }

    if (!entity.mockData) {
      errors.push('Mock data is required');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }

    // Generate MCP slug if not set
    if (!entity.mcpSlug) {
      entity.mcpSlug = this.generateSlug(entity.name);
    }

    // Update status to published
    entity.status = 'published';

    const saved = await this.appRepository.save(entity);
    const app = this.entityToApp(saved);

    return {
      endpointUrl: `/servers/${app.mcpSlug}/mcp`,
      uiUrl: `/servers/${app.mcpSlug}/ui/${app.layoutTemplate}.html`,
      app,
    };
  }

  /**
   * Set current session app
   */
  setCurrentApp(id: string): void {
    this.currentAppId = id;
  }

  /**
   * Clear current session app
   */
  clearCurrentApp(): void {
    this.currentAppId = null;
  }

  /**
   * Generate URL-safe slug from app name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  /**
   * Convert entity to App interface
   */
  private entityToApp(entity: AppEntity): App {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      layoutTemplate: entity.layoutTemplate,
      systemPrompt: entity.systemPrompt,
      themeVariables: entity.themeVariables,
      mockData: entity.mockData,
      toolName: entity.toolName,
      toolDescription: entity.toolDescription,
      mcpSlug: entity.mcpSlug,
      status: entity.status,
    };
  }
}
