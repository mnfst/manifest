/**
 * The reserved per-tenant "Playground" agent that backs the global Playground.
 * Playground runs resolve to it (so they record `agent_name = 'Playground'` in
 * global Messages) and it has the tenant's whole global provider
 * pool enabled. It is flagged `is_playground = true`, hidden from the agent list/switcher/
 * counts, and users cannot create or rename an agent to this name.
 */
export const PLAYGROUND_AGENT_NAME = 'Playground';

/**
 * The slug a user-created agent name would produce if it tried to take the
 * reserved name. User agent names are slugified, so blocking this slug in
 * create/rename reserves the name (the playground agent itself is created directly,
 * bypassing slugify, so it keeps the display-cased `PLAYGROUND_AGENT_NAME`).
 */
export const PLAYGROUND_AGENT_SLUG = 'playground';
