import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import type { NodeInstance, UserIntentNodeParameters, Connection } from '@chatgpt-app-builder/shared';

/**
 * Seed service that creates default fixtures on application startup.
 * Creates a "Test App" with a "Test Flow" for PR testing if no apps exist.
 * Also runs migration for existing flows to move tool properties to trigger nodes.
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
    await this.migrateTriggerProperties();
    await this.seedDefaultFixtures();
  }

  /**
   * Migrate existing flows to move tool properties from flow to trigger nodes.
   * This is a one-time migration that runs on startup.
   *
   * For each flow without trigger nodes that have toolName:
   * 1. If flow has legacy toolName, create a UserIntent node with those properties
   * 2. Connect the trigger to any existing action nodes
   */
  private async migrateTriggerProperties(): Promise<void> {
    const flows = await this.flowRepository.find();
    let migratedCount = 0;

    for (const flow of flows) {
      const nodes = flow.nodes ?? [];
      const connections = flow.connections ?? [];

      // Check if flow has any UserIntent nodes
      const existingTriggers = nodes.filter(n => n.type === 'UserIntent');

      if (existingTriggers.length > 0) {
        // Flow already has triggers - check if they have toolName set
        let needsUpdate = false;
        for (const trigger of existingTriggers) {
          const params = trigger.parameters as Record<string, unknown>;
          if (!params.toolName) {
            // Generate toolName from node name
            params.toolName = this.toSnakeCase(trigger.name);
            params.toolDescription = params.toolDescription ?? '';
            params.parameters = params.parameters ?? [];
            params.isActive = params.isActive ?? true;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          flow.nodes = nodes;
          await this.flowRepository.save(flow);
          migratedCount++;
        }
        continue;
      }

      // No triggers - need to check if flow has legacy properties in old column format
      // Since we removed those columns, we can't migrate from them
      // Instead, create a default trigger if none exists and there are other nodes
      const actionNodes = nodes.filter(n => n.type !== 'UserIntent');

      if (actionNodes.length === 0) {
        // Empty flow, skip
        continue;
      }

      // Create a UserIntent trigger node
      const triggerId = uuidv4();
      const triggerNode: NodeInstance = {
        id: triggerId,
        type: 'UserIntent',
        name: flow.name + ' Trigger',
        position: { x: 100, y: 100 },
        parameters: {
          whenToUse: '',
          whenNotToUse: '',
          toolName: this.toSnakeCase(flow.name),
          toolDescription: flow.description ?? `Execute the ${flow.name} flow`,
          parameters: [],
          isActive: true,
        },
      };

      // Find the leftmost action node to connect to
      const leftmostNode = actionNodes.reduce((left, node) => {
        return node.position.x < left.position.x ? node : left;
      }, actionNodes[0]);

      // Create connection from trigger to leftmost node
      const newConnection: Connection = {
        id: uuidv4(),
        sourceNodeId: triggerId,
        sourceHandle: 'main',
        targetNodeId: leftmostNode.id,
        targetHandle: 'main',
      };

      // Update flow
      flow.nodes = [triggerNode, ...nodes];
      flow.connections = [newConnection, ...connections];
      await this.flowRepository.save(flow);
      migratedCount++;

      this.logger.log(`Migrated flow "${flow.name}" - added trigger node with toolName: ${(triggerNode.parameters as UserIntentNodeParameters).toolName}`);
    }

    if (migratedCount > 0) {
      this.logger.log(`Migration complete: ${migratedCount} flows updated`);
    }
  }

  /**
   * Convert a string to snake_case for tool names.
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[\s-]+/g, '_')
      .replace(/^_/, '')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  /**
   * Seed default fixtures if no apps exist.
   * Creates:
   * - Test App (slug: test-app)
   * - Test Flow with UserIntent trigger and Interface node
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

      // Create UserIntent trigger node with tool properties
      const triggerId = uuidv4();
      const triggerNode: NodeInstance = {
        id: triggerId,
        type: 'UserIntent',
        name: 'Test Trigger',
        position: { x: 100, y: 100 },
        parameters: {
          whenToUse: 'Use this flow to test the application',
          whenNotToUse: 'Do not use in production',
          toolName: 'test_flow',
          toolDescription: 'A test flow that displays sample data in a table format',
          parameters: [],
          isActive: true,
        },
      };

      // Create Interface node
      const interfaceId = uuidv4();
      const interfaceNode: NodeInstance = {
        id: interfaceId,
        type: 'Interface',
        name: 'Test Interface',
        position: { x: 330, y: 100 },
        parameters: {
          layoutTemplate: 'table',
        },
      };

      // Create connection from trigger to interface
      const connection: Connection = {
        id: uuidv4(),
        sourceNodeId: triggerId,
        sourceHandle: 'main',
        targetNodeId: interfaceId,
        targetHandle: 'main',
      };

      const testFlow = this.flowRepository.create({
        id: uuidv4(),
        appId: savedApp.id,
        name: 'Test Flow',
        description: 'Default test flow for PR testing',
        isActive: true,
        nodes: [triggerNode, interfaceNode],
        connections: [connection],
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
