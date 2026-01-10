/**
 * Test fixtures and mock factories for App module tests
 *
 * Usage:
 *   import { createMockApp, createMockAppEntity, createMockCreateAppRequest } from './test/fixtures';
 *
 *   const app = createMockApp(); // Get default mock app
 *   const app = createMockApp({ name: 'Custom Name' }); // Override specific fields
 */

import type {
  App,
  AppWithFlowCount,
  CreateAppRequest,
  UpdateAppRequest,
  DeleteAppResponse,
  PublishResult,
  ThemeVariables,
  AppStatus,
} from '@chatgpt-app-builder/shared';
import { DEFAULT_THEME_VARIABLES } from '@chatgpt-app-builder/shared';
import type { AppEntity } from '../app.entity';

/**
 * Creates a mock App object for testing
 * @param overrides - Optional partial App to override defaults
 */
export function createMockApp(overrides: Partial<App> = {}): App {
  return {
    id: 'test-app-id',
    name: 'Test App',
    description: 'Test app description',
    slug: 'test-app',
    themeVariables: { ...DEFAULT_THEME_VARIABLES },
    status: 'draft' as AppStatus,
    logoUrl: '/icons/icon-blue.png',
    createdAt: '2026-01-08T00:00:00.000Z',
    updatedAt: '2026-01-08T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a mock AppWithFlowCount object for testing list endpoints
 * @param overrides - Optional partial AppWithFlowCount to override defaults
 */
export function createMockAppWithFlowCount(
  overrides: Partial<AppWithFlowCount> = {},
): AppWithFlowCount {
  return {
    ...createMockApp(overrides),
    flowCount: 0,
    ...overrides,
  };
}

/**
 * Creates a mock AppEntity for repository tests
 * @param overrides - Optional partial AppEntity to override defaults
 */
export function createMockAppEntity(
  overrides: Partial<AppEntity> = {},
): AppEntity {
  const now = new Date();
  return {
    id: 'test-entity-id',
    name: 'Test Entity',
    description: 'Entity description',
    slug: 'test-entity',
    themeVariables: { ...DEFAULT_THEME_VARIABLES },
    status: 'draft' as AppStatus,
    logoUrl: '/icons/icon-blue.png',
    createdAt: now,
    updatedAt: now,
    flows: [],
    ...overrides,
  } as AppEntity;
}

/**
 * Creates a mock CreateAppRequest for testing app creation
 * @param overrides - Optional partial CreateAppRequest to override defaults
 */
export function createMockCreateAppRequest(
  overrides: Partial<CreateAppRequest> = {},
): CreateAppRequest {
  return {
    name: 'New Test App',
    description: 'A new test app',
    ...overrides,
  };
}

/**
 * Creates a mock UpdateAppRequest for testing app updates
 * @param overrides - Optional partial UpdateAppRequest to override defaults
 */
export function createMockUpdateAppRequest(
  overrides: Partial<UpdateAppRequest> = {},
): UpdateAppRequest {
  return {
    name: 'Updated App Name',
    ...overrides,
  };
}

/**
 * Creates a mock DeleteAppResponse for testing deletion
 * @param overrides - Optional partial DeleteAppResponse to override defaults
 */
export function createMockDeleteAppResponse(
  overrides: Partial<DeleteAppResponse> = {},
): DeleteAppResponse {
  return {
    success: true,
    deletedFlowCount: 0,
    ...overrides,
  };
}

/**
 * Creates a mock PublishResult for testing publish endpoint
 * @param overrides - Optional partial PublishResult to override defaults
 */
export function createMockPublishResult(
  overrides: Partial<PublishResult> = {},
): PublishResult {
  const app = createMockApp({ status: 'published' });
  return {
    endpointUrl: `/servers/${app.slug}/mcp`,
    uiUrl: `/servers/${app.slug}/ui`,
    app,
    ...overrides,
  };
}

/**
 * Creates mock theme variables
 * @param overrides - Optional partial ThemeVariables to override defaults
 */
export function createMockThemeVariables(
  overrides: Partial<ThemeVariables> = {},
): ThemeVariables {
  return {
    ...DEFAULT_THEME_VARIABLES,
    ...overrides,
  };
}
