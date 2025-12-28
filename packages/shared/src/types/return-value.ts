/**
 * ReturnValue entity representing a text content item to return from an MCP tool
 * Multiple return values can belong to a single flow, ordered by position
 */
export interface ReturnValue {
  id: string;
  flowId: string;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new return value
 */
export interface CreateReturnValueRequest {
  text: string;
}

/**
 * Request to update a return value
 */
export interface UpdateReturnValueRequest {
  text?: string;
}

/**
 * Request to reorder return values within a flow
 */
export interface ReorderReturnValuesRequest {
  orderedIds: string[];
}
