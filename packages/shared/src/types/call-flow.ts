/**
 * CallFlow entity representing an end action that triggers another flow
 * Multiple call flows can belong to a single flow, ordered by position
 */
export interface CallFlow {
  id: string;
  flowId: string;
  targetFlowId: string;
  targetFlow?: {
    id: string;
    name: string;
    toolName: string;
  };
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new call flow
 */
export interface CreateCallFlowRequest {
  targetFlowId: string;
}

/**
 * Request to update a call flow
 */
export interface UpdateCallFlowRequest {
  targetFlowId?: string;
}

/**
 * Request to reorder call flows within a flow
 */
export interface ReorderCallFlowsRequest {
  orderedIds: string[];
}
