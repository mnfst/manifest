/**
 * Type of target for action connections
 */
export type ActionTargetType = 'return-value' | 'call-flow';

/**
 * ActionConnection entity representing a link between a View's action and its target
 */
export interface ActionConnection {
  id: string;
  viewId: string;
  actionName: string;
  targetType: ActionTargetType;
  targetReturnValueId?: string;
  targetCallFlowId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new action connection
 */
export interface CreateActionConnectionRequest {
  actionName: string;
  targetType: ActionTargetType;
  targetReturnValueId?: string;
  targetCallFlowId?: string;
}

/**
 * Request to update an existing action connection
 */
export interface UpdateActionConnectionRequest {
  targetType: ActionTargetType;
  targetReturnValueId?: string;
  targetCallFlowId?: string;
}
