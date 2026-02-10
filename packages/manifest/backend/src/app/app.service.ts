import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { AppEntity } from './app.entity';
import { UserAppRoleEntity } from '../auth/user-app-role.entity';
import type { App, AppWithFlowCount, CreateAppRequest, UpdateAppRequest, PublishResult, ThemeVariables, DeleteAppResponse } from '@manifest/shared';
import { DEFAULT_THEME_VARIABLES } from '@manifest/shared';
import { getRandomDefaultIcon } from './utils/default-icons.utils';
import { entityToApp, entityToAppWithFlowCount } from '../utils/entity-mappers';

/**
 * Service for App CRUD operations
 */
@Injectable()
export class AppService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    @InjectRepository(UserAppRoleEntity)
    private readonly userAppRoleRepository: Repository<UserAppRoleEntity>,
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
   * @param request - App creation request
   * @param ownerId - User ID of the creator who will become the owner
   */
  async create(request: CreateAppRequest, ownerId: string): Promise<App> {
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
      logoUrl: getRandomDefaultIcon(),
    });

    const saved = await this.appRepository.save(entity);

    // Assign the creator as owner of the new app
    const ownerRole = this.userAppRoleRepository.create({
      userId: ownerId,
      appId: saved.id,
      role: 'owner',
    });
    await this.userAppRoleRepository.save(ownerRole);

    return entityToApp(saved);
  }

  /**
   * Get all apps sorted by creation date (newest first) with flow counts
   */
  async findAll(): Promise<AppWithFlowCount[]> {
    const entities = await this.appRepository
      .createQueryBuilder('app')
      .loadRelationCountAndMap('app.flowCount', 'app.flows')
      .orderBy('app.createdAt', 'DESC')
      .getMany();
    return entities.map((e) => entityToAppWithFlowCount(e as AppEntity & { flowCount: number }));
  }

  /**
   * Get apps accessible by a specific user (with flow counts)
   */
  async getAppsForUser(userId: string): Promise<AppWithFlowCount[]> {
    // Get app IDs the user has access to
    const userRoles = await this.userAppRoleRepository.find({
      where: { userId },
      select: ['appId'],
    });

    const appIds = userRoles.map((r) => r.appId);

    if (appIds.length === 0) {
      return [];
    }

    const entities = await this.appRepository
      .createQueryBuilder('app')
      .loadRelationCountAndMap('app.flowCount', 'app.flows')
      .where('app.id IN (:...appIds)', { appIds })
      .orderBy('app.createdAt', 'DESC')
      .getMany();

    return entities.map((e) => entityToAppWithFlowCount(e as AppEntity & { flowCount: number }));
  }

  /**
   * Get app by ID
   */
  async findById(id: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({ where: { id } });
    return entity ? entityToApp(entity) : null;
  }

  /**
   * Get app by slug
   */
  async findBySlug(slug: string): Promise<App | null> {
    const entity = await this.appRepository.findOne({ where: { slug } });
    return entity ? entityToApp(entity) : null;
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
    return entityToApp(saved);
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
    const app = entityToApp(saved);

    return {
      endpointUrl: `/servers/${app.slug}/mcp`,
      app,
    };
  }

  /**
   * Update app icon URL
   */
  async updateIcon(id: string, iconUrl: string): Promise<App> {
    const entity = await this.appRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`App with id ${id} not found`);
    }

    entity.logoUrl = iconUrl;
    const saved = await this.appRepository.save(entity);
    return entityToApp(saved);
  }

  /**
   * Delete an app and all its flows (cascade delete)
   */
  async delete(id: string): Promise<DeleteAppResponse> {
    const entity = await this.appRepository.findOne({
      where: { id },
      relations: ['flows'],
    });

    if (!entity) {
      throw new NotFoundException(`App with id ${id} not found`);
    }

    const deletedFlowCount = entity.flows?.length ?? 0;

    await this.appRepository.remove(entity);

    return {
      success: true,
      deletedFlowCount,
    };
  }

}
