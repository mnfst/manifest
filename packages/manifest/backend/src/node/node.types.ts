import type { NodeTypeCategory } from '@manifest/shared';
import type { NodeTypeInfo } from '@manifest/nodes';

/**
 * Category info for grouping nodes in the UI
 */
export interface CategoryInfo {
  id: NodeTypeCategory;
  displayName: string;
  order: number;
}

/**
 * Response for GET /api/node-types
 */
export interface NodeTypesResponse {
  nodeTypes: NodeTypeInfo[];
  categories: CategoryInfo[];
}
