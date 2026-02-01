import type { App, AppWithFlowCount } from '@manifest/shared';

/**
 * Type guard to check if app has flowCount property.
 */
export function hasFlowCount(
  app: App | AppWithFlowCount,
): app is AppWithFlowCount {
  return 'flowCount' in app && typeof app.flowCount === 'number';
}
