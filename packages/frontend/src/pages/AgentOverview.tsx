/**
 * AgentOverview — the agent-scoped overview page.
 *
 * This is the canonical name for the agent dashboard (renamed from Overview
 * for symmetry with GlobalOverview from PR1). All logic lives in Overview.tsx;
 * this file re-exports it so both import paths work during the transition and
 * the route table can reference the semantically-correct name.
 */
export { default } from './Overview.js';
