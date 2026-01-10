import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppEntity } from '../app/app.entity';
import { FlowEntity } from '../flow/flow.entity';
import { UserAppRoleEntity } from '../auth/user-app-role.entity';
import { auth } from '../auth/auth';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import type { NodeInstance, UserIntentNodeParameters, Connection } from '@chatgpt-app-builder/shared';

/**
 * Seed service that creates default fixtures on application startup.
 * Creates a "Test App" with a "Test Flow" for PR testing if no apps exist.
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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.migrateTriggerProperties();
    const adminUser = await this.seedAdminUser();
    await this.seedDefaultFixtures(adminUser?.id);
    await this.assignExistingAppsToAdmin(adminUser?.id);
  }

  /**
   * Seed admin user if not exists.
   * Creates admin@manifest.build with password "admin".
   */
  private async seedAdminUser(): Promise<{ id: string; email: string } | null> {
    const adminEmail = 'admin@manifest.build';
    const adminPassword = 'admin';

    try {
      // Try to create admin user via better-auth signUp
      const result = await auth.api.signUpEmail({
        body: {
          email: adminEmail,
          password: adminPassword,
          name: 'Admin User',
          firstName: 'Admin',
          lastName: 'User',
        },
      });

      if (result?.user) {
        this.logger.log(`Created admin user: ${adminEmail}`);
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
              email: adminEmail,
              password: adminPassword,
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
   * - Test App (slug: test-app) owned by admin user
   * - Test Flow with UserIntent trigger and Interface node
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

      // Assign admin user as owner of Test App
      if (adminUserId) {
        const ownerRole = this.userAppRoleRepository.create({
          userId: adminUserId,
          appId: savedApp.id,
          role: 'owner',
        });
        await this.userAppRoleRepository.save(ownerRole);
        this.logger.log(`Assigned admin as owner of Test App`);
      }

      this.logger.log('Default fixtures seeded successfully');
    } catch (error) {
      this.logger.error('Failed to seed default fixtures', error);
      throw error;
    }
  }
}
