import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import type { NodeInstance, UserIntentNodeParameters, Connection, ExecutionStatus } from '@chatgpt-app-builder/shared';

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
    private readonly flowRepository: Repository<FlowEntity>,
    @InjectRepository(FlowExecutionEntity)
    private readonly executionRepository: Repository<FlowExecutionEntity>
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
        status: 'published',
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
          toolDescription: 'A test flow that displays sample statistics',
          parameters: [],
          isActive: true,
        },
      };

      // Create StatCard node
      const statCardId = uuidv4();
      const statCardNode: NodeInstance = {
        id: statCardId,
        type: 'StatCard',
        name: 'Test StatCard',
        position: { x: 330, y: 100 },
        parameters: {
          layoutTemplate: 'stat-card',
        },
      };

      // Create connection from trigger to StatCard
      const connection: Connection = {
        id: uuidv4(),
        sourceNodeId: triggerId,
        sourceHandle: 'main',
        targetNodeId: statCardId,
        targetHandle: 'main',
      };

      const testFlow = this.flowRepository.create({
        id: uuidv4(),
        appId: savedApp.id,
        name: 'Test Flow',
        description: 'Default test flow for PR testing',
        isActive: true,
        nodes: [triggerNode, statCardNode],
        connections: [connection],
      });

      const savedFlow = await this.flowRepository.save(testFlow);
      this.logger.log(`Created Test Flow with id: ${savedFlow.id}`);

      // Seed execution data for analytics testing
      await this.seedExecutionData(savedFlow.id, savedFlow.name, 'test_flow');

      this.logger.log('Default fixtures seeded successfully');
    } catch (error) {
      this.logger.error('Failed to seed default fixtures', error);
      throw error;
    }
  }

  /**
   * Generate sample execution data for analytics testing.
   * Creates ~50 executions spread over the last 4 days (excluding last 24h) with:
   * - ~92% success rate
   * - Varied timestamps for chart visualization
   * - Realistic duration distribution (500-1500ms)
   */
  private async seedExecutionData(
    flowId: string,
    flowName: string,
    flowToolName: string
  ): Promise<void> {
    const executions: Partial<FlowExecutionEntity>[] = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const fourDaysMs = 4 * oneDayMs;

    // Generate ~50 executions over the last 4 days, but NOT in the last 24 hours
    for (let i = 0; i < 50; i++) {
      // Random timestamp between 1 day ago and 4 days ago (excludes last 24h)
      const randomOffset = oneDayMs + Math.random() * (fourDaysMs - oneDayMs);
      const startedAt = new Date(now - randomOffset);

      // Random duration between 500ms and 1500ms
      const durationMs = 500 + Math.random() * 1000;
      const endedAt = new Date(startedAt.getTime() + durationMs);

      // ~92% success rate
      const status: ExecutionStatus = Math.random() < 0.92 ? 'fulfilled' : 'error';

      const execution: Partial<FlowExecutionEntity> = {
        id: uuidv4(),
        flowId,
        flowName,
        flowToolName,
        status,
        startedAt,
        endedAt,
        initialParams: { testParam: `value_${i}` },
        nodeExecutions: [],
        isPreview: false,
      };

      // Add error info for failed executions
      if (status === 'error') {
        execution.errorInfo = {
          message: 'Sample error for testing',
        };
      }

      executions.push(execution);
    }

    // Bulk insert
    await this.executionRepository.save(executions);
    this.logger.log(`Created ${executions.length} sample executions for analytics (last 4 days, excluding last 24h)`);
  }
}
