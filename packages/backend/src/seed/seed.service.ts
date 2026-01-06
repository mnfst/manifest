import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import type { NodeInstance } from '@chatgpt-app-builder/shared';

/**
 * Seed service that creates default fixtures on application startup.
 * Creates a "Test App" with a "Test Flow" for PR testing if no apps exist.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultFixtures();
  }

  /**
   * Seed default fixtures if no apps exist.
   * Creates:
   * - Test App (slug: test-app)
   * - Test Flow with user intent and Interface node
   */
  private async seedDefaultFixtures(): Promise<void> {
    // Check if any apps exist
    const appCount = await this.appRepository.count();
    if (appCount > 0) {
      this.logger.log('Apps already exist, skipping seed');
      return;
    }

    this.logger.log('No apps found, seeding default fixtures...');

    try {
      // Create Test App
      const testApp = this.appRepository.create({
        id: uuidv4(),
        name: 'Test App',
        description: 'Default test application for PR testing',
        slug: 'test-app',
        themeVariables: DEFAULT_THEME_VARIABLES,
        status: 'draft',
        logoUrl: '/icons/icon-blue.png',
      });

      const savedApp = await this.appRepository.save(testApp);
      this.logger.log(`Created Test App with id: ${savedApp.id}`);

      // Create Test Flow with user intent
      const interfaceNode: NodeInstance = {
        id: uuidv4(),
        type: 'Interface',
        name: 'Test Interface',
        position: { x: 330, y: 100 },
        parameters: {
          layoutTemplate: 'table',
        },
      };

      const testFlow = this.flowRepository.create({
        id: uuidv4(),
        appId: savedApp.id,
        name: 'Test Flow',
        description: 'Default test flow for PR testing',
        toolName: 'test_flow',
        toolDescription: 'A test flow that displays sample data in a table format',
        whenToUse: 'Use this flow to test the application',
        whenNotToUse: 'Do not use in production',
        isActive: true,
        parameters: [],
        nodes: [interfaceNode],
        connections: [],
      });

      const savedFlow = await this.flowRepository.save(testFlow);
      this.logger.log(`Created Test Flow with id: ${savedFlow.id}`);

      this.logger.log('Default fixtures seeded successfully');
    } catch (error) {
      this.logger.error('Failed to seed default fixtures', error);
      throw error;
    }
  }
}
