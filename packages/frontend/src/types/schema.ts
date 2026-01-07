import type { CompatibilityStatus, SchemaCompatibilityResult, JSONSchema, FlattenedSchemaField } from '@chatgpt-app-builder/shared';

/**
 * Validation state for a connection edge (frontend only).
 * Attached to edge data for visual feedback.
 */
export interface ConnectionValidationState {
  /** Compatibility status */
  status: CompatibilityStatus;

  /** Number of errors */
  errorCount: number;

  /** Number of warnings */
  warningCount: number;

  /** Summary message for tooltip */
  summary: string;

  /** Full compatibility result (for detail panel) */
  details?: SchemaCompatibilityResult;
}

/**
 * Status colors for connection edges.
 */
export const STATUS_COLORS: Record<CompatibilityStatus, string> = {
  compatible: '#22c55e',  // green-500
  warning: '#eab308',     // yellow-500
  error: '#ef4444',       // red-500
  unknown: '#6b7280',     // gray-500
};

/**
 * Get a human-readable label for a compatibility status.
 */
export function getStatusLabel(status: CompatibilityStatus): string {
  switch (status) {
    case 'compatible':
      return 'Compatible';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Incompatible';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Unknown';
  }
}

/**
 * Information about an upstream node for the "Use Previous Outputs" component.
 * Used to populate dropdowns with available nodes and their output fields.
 */
export interface UpstreamNodeInfo {
  /** Unique node ID */
  id: string;

  /** Human-readable slug for template references */
  slug: string;

  /** Display name of the node */
  name: string;

  /** Node type (e.g., "UserIntent", "ApiCall") */
  type: string;

  /** Output schema of the node (null if unknown) */
  outputSchema: JSONSchema | null;

  /** Flattened output fields for dropdown display */
  fields: FlattenedSchemaField[];
}
