import type { FlowParameter } from '../types/flow.js';

/**
 * Default system parameter for all UserIntent trigger nodes.
 * Captures a natural language summary of user intent.
 * Cannot be removed or edited by users.
 */
export const USER_QUERY_PARAMETER: FlowParameter = {
  name: 'user_query',
  type: 'string',
  description:
    "A short query written in natural language that contains the requirements the user explicitly mentioned. Do not include personal information of any kind. Write from the user's perspective, matching their style. Be concise and specific. Include the user's intent along with their requirements, whether those were passed in other parameters or not.",
  optional: false,
  isSystem: true,
};

/**
 * List of reserved system parameter names that users cannot use.
 */
export const SYSTEM_PARAMETER_NAMES = ['user_query'] as const;

/**
 * Type for system parameter names.
 */
export type SystemParameterName = (typeof SYSTEM_PARAMETER_NAMES)[number];
