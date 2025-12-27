import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { AppEntity } from '../entities/app.entity';
import type { App, CreateAppRequest, UpdateAppRequest, PublishResult, ThemeVariables } from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';

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
   * Generate a unique slug from app name
   * Adds numeric suffix if slug already exists
   */
  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name, {
      lower: true,
      strict: true,
      trim: true,
    }).substring(0, 50);

    // Check if slug exists
    let slug = baseSlug;
    let counter = 1;

    while (await this.appRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create a new app and set as current session app
   */
  async create(request: CreateAppRequest): Promise<App> {
    const slug = await this.generateUniqueSlug(request.name);

    const themeVariables: ThemeVariables = {
      ...DEFAULT_THEME_VARIABLES,
      ...request.themeVariables,
    };

    const entity = this.appRepository.create({
      name: request.name,
      description: request.description,
      slug,
      themeVariables,
      status: 'draft',
    });

    const saved = await this.appRepository.save(entity);
    this.currentAppId = saved.id;
    return this.entityToApp(saved);
  }

  /**
   * Get all apps sorted by creation date (newest first)
   */
  async findAll(): Promise<App[]> {
    const entities = await this.appRepository.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.entityToApp(e));
  }

  /**
   * Get app by ID
   */
  async findById(id: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({ where: { id } });
    return entity ? this.entityToApp(entity) : null;
  }

  /**
   * Get app by slug
   */
  async findBySlug(slug: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({ where: { slug } });
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
  async update(id: string, updates: UpdateAppRequest): Promise<App> {
    const entity = await this.appRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`App with id ${id} not found`);
    }

    if (updates.name !== undefined) {
      entity.name = updates.name;
    }
    if (updates.description !== undefined) {
      entity.description = updates.description;
    }
    if (updates.themeVariables !== undefined) {
      entity.themeVariables = {
        ...entity.themeVariables,
        ...updates.themeVariables,
      };
    }
    if (updates.status !== undefined) {
      entity.status = updates.status;
    }

    const saved = await this.appRepository.save(entity);
    return this.entityToApp(saved);
  }

  /**
   * Publish an app to MCP server
   * Note: Publishing now requires at least one flow with views
   */
  async publish(id: string): Promise<PublishResult> {
    const entity = await this.appRepository.findOne({
      where: { id },
      relations: ['flows', 'flows.views'],
    });

    if (!entity) {
      throw new NotFoundException(`App with id ${id} not found`);
    }

    // Validate app has flows
    const errors: string[] = [];
    if (!entity.flows || entity.flows.length === 0) {
      errors.push('App must have at least one flow to publish');
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors.join('; '));
    }

    // Update status to published
    entity.status = 'published';

    const saved = await this.appRepository.save(entity);
    const app = this.entityToApp(saved);

    return {
      endpointUrl: `/servers/${app.slug}/mcp`,
      uiUrl: `/servers/${app.slug}/ui`,
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
   * Convert entity to App interface
   */
  private entityToApp(entity: AppEntity): App {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      slug: entity.slug,
      themeVariables: entity.themeVariables,
      status: entity.status,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }
}
