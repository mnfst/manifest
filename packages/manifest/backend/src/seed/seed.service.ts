import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { UserAppRoleEntity } from '../auth/user-app-role.entity';
import { auth } from '../auth/auth';
import { FlowExecutionEntity } from '../flow-execution/flow-execution.entity';
import { DEFAULT_THEME_VARIABLES, DEFAULT_ADMIN_USER, USER_QUERY_PARAMETER, toSnakeCase } from '@manifest/shared';
import type { NodeInstance, UserIntentNodeParameters, Connection, ExecutionStatus } from '@manifest/shared';

/**
 * Seed service that creates default fixtures on application startup.
 * Creates an "EventHub" app with a "Search events in a city" flow if no apps exist.
 * Also creates admin user and assigns ownership.
 * Runs migration for existing flows to move tool properties to trigger nodes.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
    @InjectRepository(FlowEntity)
    private readonly flowRepository: Repository<FlowEntity>,
    @InjectRepository(UserAppRoleEntity)
    private readonly userAppRoleRepository: Repository<UserAppRoleEntity>,
    @InjectRepository(FlowExecutionEntity)
    private readonly executionRepository: Repository<FlowExecutionEntity>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.migrateTriggerProperties();
    const adminUser = await this.seedAdminUser();
    await this.seedDefaultFixtures(adminUser?.id);
    await this.assignExistingAppsToAdmin(adminUser?.id);
  }

  /**
   * Seed admin user if not exists.
   * Uses DEFAULT_ADMIN_USER from shared package for credentials.
   */
  private async seedAdminUser(): Promise<{ id: string; email: string } | null> {
    try {
      // Try to create admin user via better-auth signUp
      const result = await auth.api.signUpEmail({
        body: {
          email: DEFAULT_ADMIN_USER.email,
          password: DEFAULT_ADMIN_USER.password,
          name: DEFAULT_ADMIN_USER.name,
          firstName: DEFAULT_ADMIN_USER.firstName,
          lastName: DEFAULT_ADMIN_USER.lastName,
        },
      });

      if (result?.user) {
        this.logger.log(`Created admin user: ${DEFAULT_ADMIN_USER.email}`);
        return { id: result.user.id, email: result.user.email };
      }

      this.logger.warn('Failed to create admin user - no user returned');
      return null;
    } catch (error: unknown) {
      // User might already exist - try to sign in to get the user ID
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('already exists') || errorMessage.includes('USER_ALREADY_EXISTS')) {
        this.logger.log('Admin user already exists, fetching via sign-in...');
        try {
          const signInResult = await auth.api.signInEmail({
            body: {
              email: DEFAULT_ADMIN_USER.email,
              password: DEFAULT_ADMIN_USER.password,
            },
          });
          if (signInResult?.user) {
            return { id: signInResult.user.id, email: signInResult.user.email };
          }
        } catch {
          this.logger.warn('Could not sign in as admin user');
        }
      } else {
        this.logger.warn(`Error creating admin user: ${errorMessage}`);
      }

      return null;
    }
  }

  /**
   * Assign all existing apps without owners to the admin user.
   * This handles migration from pre-auth databases.
   */
  private async assignExistingAppsToAdmin(adminUserId: string | undefined): Promise<void> {
    if (!adminUserId) {
      this.logger.warn('No admin user ID provided, skipping app ownership assignment');
      return;
    }

    const apps = await this.appRepository.find();
    let assignedCount = 0;

    for (const app of apps) {
      // Check if app has any owner
      const existingOwner = await this.userAppRoleRepository.findOne({
        where: { appId: app.id, role: 'owner' },
      });

      if (!existingOwner) {
        // Assign admin as owner
        const ownerRole = this.userAppRoleRepository.create({
          userId: adminUserId,
          appId: app.id,
          role: 'owner',
        });
        await this.userAppRoleRepository.save(ownerRole);
        assignedCount++;
        this.logger.log(`Assigned admin as owner of app: ${app.name}`);
      }
    }

    if (assignedCount > 0) {
      this.logger.log(`Assigned admin as owner of ${assignedCount} apps`);
    }
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
            params.toolName = toSnakeCase(trigger.name);
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
          toolName: toSnakeCase(flow.name),
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
   * Seed default fixtures if no apps exist.
   * Creates:
   * - EventHub app (slug: eventhub) owned by admin user
   * - "Search events in a city" flow with UserIntent trigger and Return node
   */
  private async seedDefaultFixtures(adminUserId: string | undefined): Promise<void> {
    // Check if any apps exist
    const appCount = await this.appRepository.count();
    if (appCount > 0) {
      this.logger.log('Apps already exist, skipping seed');
      return;
    }

    this.logger.log('No apps found, seeding default fixtures...');

    try {
      // Create demo app for local events
      const testApp = this.appRepository.create({
        id: uuidv4(),
        name: 'EventHub',
        description: 'Discover local events in your city',
        slug: 'eventhub',
        themeVariables: DEFAULT_THEME_VARIABLES,
        status: 'published',
        logoUrl: null,
      });

      const savedApp = await this.appRepository.save(testApp);
      this.logger.log(`Created EventHub app with id: ${savedApp.id}`);

      // Create UserIntent trigger node with tool properties
      const triggerId = uuidv4();
      const triggerNode: NodeInstance = {
        id: triggerId,
        type: 'UserIntent',
        name: 'Search Events Trigger',
        slug: 'search-events-trigger',
        position: { x: 100, y: 100 },
        parameters: {
          whenToUse: 'Use this when the user wants to find events happening in a specific city',
          whenNotToUse: 'Do not use for event booking or ticket purchases',
          toolName: 'search_events_in_city',
          toolDescription: 'Search for events happening in a specific city',
          parameters: [
            USER_QUERY_PARAMETER,
            {
              name: 'city',
              type: 'string',
              description: 'The city the user wants to search for events in',
              optional: false,
            },
            {
              name: 'freeEventsOnly',
              type: 'boolean',
              description: 'The user is looking for free events only',
              optional: true,
            },
          ],
          isActive: true,
        },
      };

      // Create ApiCall node to fetch events from EventHub
      const apiCallId = uuidv4();
      const apiCallNode: NodeInstance = {
        id: apiCallId,
        type: 'ApiCall',
        name: 'Fetch EventHub Events',
        slug: 'fetch-events',
        position: { x: 350, y: 100 },
        parameters: {
          method: 'GET',
          url: 'https://api.example.com/v1/events/search?city={{trigger.city}}&q={{trigger.userQuery}}',
          headers: [
            { key: 'Authorization', value: 'Bearer {{secrets.EVENTS_API_KEY}}' },
            { key: 'Content-Type', value: 'application/json' },
          ],
          timeout: 30000,
        },
      };

      // Create JavaScriptCodeTransform to format the response
      const transformId = uuidv4();
      const transformNode: NodeInstance = {
        id: transformId,
        type: 'JavaScriptCodeTransform',
        name: 'Format Events',
        slug: 'format-events',
        position: { x: 600, y: 100 },
        parameters: {
          code: `const events = input.body?.events || [];
return {
  totalFound: events.length,
  events: events.slice(0, 10).map(event => ({
    name: event.name?.text || 'Untitled Event',
    description: event.description?.text?.substring(0, 200) || '',
    startDate: event.start?.local || null,
    endDate: event.end?.local || null,
    url: event.url || null,
    isFree: event.is_free || false,
    venue: event.venue?.name || 'Online'
  }))
};`,
        },
      };

      // Create Return node to output the formatted events
      const returnId = uuidv4();
      const returnNode: NodeInstance = {
        id: returnId,
        type: 'Return',
        name: 'Return Events',
        slug: 'return-events',
        position: { x: 850, y: 100 },
        parameters: {
          text: 'Found {{transform.totalFound}} events in your area.',
        },
      };

      // Create connections: trigger -> apiCall -> transform -> return
      // Handle IDs must match what the frontend node components define
      const connections: Connection[] = [
        {
          id: uuidv4(),
          sourceNodeId: triggerId,
          sourceHandle: 'main', // UserIntentNode uses 'main' for output
          targetNodeId: apiCallId,
          targetHandle: 'input', // ApiCallNode uses 'input' for input
        },
        {
          id: uuidv4(),
          sourceNodeId: apiCallId,
          sourceHandle: 'output', // ApiCallNode uses 'output' for output
          targetNodeId: transformId,
          targetHandle: 'input', // TransformNode uses 'input' for input
        },
        {
          id: uuidv4(),
          sourceNodeId: transformId,
          sourceHandle: 'output', // TransformNode uses 'output' for output
          targetNodeId: returnId,
          targetHandle: 'input', // ReturnValueNode uses 'input' for input
        },
      ];

      const testFlow = this.flowRepository.create({
        id: uuidv4(),
        appId: savedApp.id,
        name: 'Search events in a city',
        description: 'Find events happening in a specific city',
        isActive: true,
        nodes: [triggerNode, apiCallNode, transformNode, returnNode],
        connections,
      });

      const savedFlow = await this.flowRepository.save(testFlow);
      this.logger.log(`Created flow "${savedFlow.name}" with id: ${savedFlow.id}`);

      // Assign admin user as owner of EventHub app
      if (adminUserId) {
        const ownerRole = this.userAppRoleRepository.create({
          userId: adminUserId,
          appId: savedApp.id,
          role: 'owner',
        });
        await this.userAppRoleRepository.save(ownerRole);
        this.logger.log(`Assigned admin as owner of EventHub app`);
      }

      // Seed execution data for analytics testing
      await this.seedExecutionData(savedFlow.id, savedFlow.name, 'search_events_in_city');

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
