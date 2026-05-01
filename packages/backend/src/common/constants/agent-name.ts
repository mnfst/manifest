/**
 * Single source of truth for the agent-name slug regex used at API boundaries.
 * Mirrors the slug shape produced by `slugify.ts` and the `agents.name` column
 * unique constraint. Keep this in sync with the frontend agent-name validator.
 */
export const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const AGENT_NAME_MESSAGE = 'Invalid agent name';
