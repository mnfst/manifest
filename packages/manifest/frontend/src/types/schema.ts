import type { CompatibilityStatus, SchemaCompatibilityResult, JSONSchema, FlattenedSchemaField, SuggestedTransformer } from '@manifest/shared';

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

  /** Suggested transformers that could resolve incompatibility issues */
  suggestedTransformers?: SuggestedTransformer[];
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
